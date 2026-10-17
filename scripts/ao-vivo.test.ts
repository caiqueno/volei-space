import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

let dados: Record<string, LinhaEscrita[]>

function linha(seq: number, tipo: string, tabela: string, payload: Record<string, unknown>) {
  return { id: seq, partidaId: 100, seq, clientEventId: `c-${seq}`, tipo: tabela, setNumero: 1, equipeId: null, payload: { ...payload, _motor: tipo }, desfazId: null, criadoEm: null }
}

function preparar(opcoes: { liga?: Record<string, unknown>; semEventos?: boolean; eventos?: LinhaEscrita[]; partida?: Record<string, unknown> } = {}) {
  dados = {
    Liga: [{ id: 1, status: 'ATIVA', simulacao: false, visibilidade: 'PUBLICA', ...(opcoes.liga ?? {}) }],
    Partida: [{
      id: 100, ligaId: 1, equipeAId: 1, equipeBId: 2, status: 'EM_ANDAMENTO', fase: null, categoriaCampeonatoId: null,
      setsPorA: 1, setsPorB: 0, sumulaToken: 'segredo-do-token-da-sumula', pontosPorA: 0, pontosPorB: 0, ...(opcoes.partida ?? {}),
    }],
    Equipe: [{ id: 1, nome: 'Alfa' }, { id: 2, nome: 'Beta' }],
    SetPartida: [
      { id: 1, partidaId: 100, numero: 1, pontosA: 25, pontosB: 20 },
      { id: 2, partidaId: 100, numero: 2, pontosA: 10, pontosB: 12 },
    ],
    Jogador: [{ id: 11, equipeId: 1, nome: 'Fulana de Tal', cpf: '111.222.333-44', telefone: '(11) 99999-0000' }],
    ...(opcoes.semEventos ? {} : { SumulaEvento: opcoes.eventos ?? [] }),
  }
  banco.atual = criarBancoEscrita(dados) as any
}

const ctx = (partidaId: string): any => ({ params: Promise.resolve({ partidaId }) })
let ipSeq = 1
const get = async (rota: any, id: string, ip?: string) =>
  rota.GET(new NextRequest(`http://127.0.0.1:3001/api/ao-vivo/${id}`, { headers: { 'x-forwarded-for': ip ?? `10.1.0.${ipSeq++}` } }), ctx(id))

const CHAVES_PARTIDA = ['equipeA', 'equipeB', 'id', 'pontosA', 'pontosB', 'sacador', 'setAtual', 'setsA', 'setsB', 'status']

async function main() {
  const rota = await import('../src/app/api/ao-vivo/[partidaId]/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { limparCacheCompeticoesPrivadas } = await import('../src/lib/visibilidade-competicao')
  limparCacheCompeticoesPrivadas()

  // Flag desligada
  delete process.env.AO_VIVO_ATIVO
  delete process.env.SUMULA_EVENTOS_ATIVO
  preparar()
  assert.equal((await get(rota, '100')).status, 404)
  process.env.AO_VIVO_ATIVO = '1'

  // Id inválido ou token opaco nunca vira consulta
  for (const ruim of ['abc', 'tokenOpaco_123', '0', '-1', '1.5', '1234567890', '1e3', '']) {
    const r = await get(rota, ruim)
    assert.equal(r.status, 404, `id ${ruim}`)
    assert.equal(r.headers.get('cache-control'), 'no-store')
  }

  // Fallback pelos sets (sem log do motor)
  const ok = await get(rota, '100')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('cache-control'), 'public, max-age=0, s-maxage=2')
  const corpo = (await ok.json()) as any
  assert.deepEqual(Object.keys(corpo), ['data'])
  assert.deepEqual(Object.keys(corpo.data).sort(), ['atualizadoEm', 'partida', 'sets'])
  assert.deepEqual(Object.keys(corpo.data.partida).sort(), CHAVES_PARTIDA)
  assert.deepEqual(corpo.data.partida, { id: 100, equipeA: 'Alfa', equipeB: 'Beta', status: 'EM_ANDAMENTO', setsA: 1, setsB: 0, setAtual: 2, pontosA: 10, pontosB: 12, sacador: null })
  assert.deepEqual(corpo.data.sets, [{ numero: 1, a: 25, b: 20 }, { numero: 2, a: 10, b: 12 }])
  assert.ok(!Number.isNaN(Date.parse(corpo.data.atualizadoEm)))
  // Sem PII nem segredo em nenhuma parte da resposta
  const texto = JSON.stringify(corpo)
  for (const proibido of ['Fulana', '111.222', '99999', 'segredo-do-token', 'sumulaToken', 'cpf', 'telefone', 'jogador']) {
    assert.ok(!texto.toLowerCase().includes(proibido.toLowerCase()), `vazou ${proibido}`)
  }

  // Partida encerrada: sem set atual nem sacador
  preparar({ partida: { status: 'ENCERRADA', setsPorA: 2, setsPorB: 0 } })
  const enc = ((await (await get(rota, '100')).json()) as any).data.partida
  assert.equal(enc.setAtual, null)
  assert.equal(enc.pontosA, 0)
  assert.equal(enc.setsA, 2)

  // Agendada sem sets
  preparar({ partida: { status: 'AGENDADA', setsPorA: 0, setsPorB: 0 } })
  dados.SetPartida!.length = 0
  const ag = ((await (await get(rota, '100')).json()) as any).data
  assert.equal(ag.partida.status, 'AGENDADA')
  assert.equal(ag.partida.setAtual, null)
  assert.deepEqual(ag.sets, [])

  // Equipe ainda a definir
  preparar({ partida: { equipeBId: null } })
  assert.equal((((await (await get(rota, '100')).json()) as any).data.partida.equipeB), 'A definir')

  // Não encontrada, privada, simulação e rascunho: o mesmo 404
  preparar()
  const inexistente = await get(rota, '999')
  assert.equal(inexistente.status, 404)
  const corpo404 = await inexistente.json()
  for (const liga of [{ visibilidade: 'PRIVADA' }, { simulacao: true }, { status: 'RASCUNHO' }]) {
    preparar({ liga })
    const r = await get(rota, '100')
    assert.equal(r.status, 404, JSON.stringify(liga))
    assert.deepEqual(await r.json(), corpo404, 'mesma resposta que partida inexistente')
    assert.equal(r.headers.get('cache-control'), 'no-store')
  }

  // Derivado do log do motor quando houver
  process.env.SUMULA_EVENTOS_ATIVO = '1'
  const eventos = [
    linha(1, 'SET_INICIADO', 'INICIO_SET', { numeroSet: 1, formacaoA: [11, 12, 13, 14, 15, 16], formacaoB: [21, 22, 23, 24, 25, 26], saqueInicial: 'A' }),
    linha(2, 'PONTO', 'PONTO', { equipe: 'A' }),
    linha(3, 'PONTO', 'PONTO', { equipe: 'B' }),
    linha(4, 'PONTO', 'PONTO', { equipe: 'B' }),
  ]
  preparar({ eventos })
  const log = (await (await get(rota, '100')).json()) as any
  assert.deepEqual(log.data.partida, { id: 100, equipeA: 'Alfa', equipeB: 'Beta', status: 'EM_ANDAMENTO', setsA: 0, setsB: 0, setAtual: 1, pontosA: 1, pontosB: 2, sacador: 'B' })
  assert.deepEqual(log.data.sets, [{ numero: 1, a: 1, b: 2 }])
  assert.ok(!JSON.stringify(log).includes('formacao'), 'sem formação (números de jogadores)')

  // Tabela de eventos ausente ou vazia: cai para os sets
  preparar({ semEventos: true })
  assert.equal((((await (await get(rota, '100')).json()) as any).data.partida.pontosB), 12)
  preparar({ eventos: [] })
  assert.equal((((await (await get(rota, '100')).json()) as any).data.partida.pontosB), 12)
  delete process.env.SUMULA_EVENTOS_ATIVO

  // Rate limit por IP
  preparar()
  reiniciarCotas()
  const ip = '10.9.9.9'
  for (let i = 0; i < 120; i += 1) assert.equal((await get(rota, '100', ip)).status, 200)
  const limitado = await get(rota, '100', ip)
  assert.equal(limitado.status, 429)
  assert.ok(Number(limitado.headers.get('retry-after')) >= 1)
  assert.equal(limitado.headers.get('cache-control'), 'no-store')
  assert.equal((await get(rota, '100', '10.9.9.10')).status, 200, 'outro IP não é afetado')

  // Falha de leitura: 500 sem detalhe
  banco.atual = { from: () => { throw new Error('boom') } } as any
  reiniciarCotas()
  const falha = await get(rota, '100')
  assert.equal(falha.status, 500)
  assert.ok(!JSON.stringify(await falha.json()).includes('boom'))

  console.log('ao-vivo.test.ts: ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
