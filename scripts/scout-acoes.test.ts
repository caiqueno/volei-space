import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const acesso: { escrita: 'ok' | 'negado'; leitura: 'ok' | 'negado' } = { escrita: 'ok', leitura: 'ok' }
function stub(caminho: string, exports: Record<string, unknown>) {
  const resolvido = require.resolve(caminho)
  require.cache[resolvido] = { id: resolvido, filename: resolvido, loaded: true, exports } as unknown as NodeJS.Module
}
const PARTIDA = { id: 100, ligaId: 1, equipeAId: 1, equipeBId: 2 }
stub('../src/lib/sumula-access', {
  requireSumulaTokenAccess: async (token: string) => (token === 'tk' ? { partida: PARTIDA } : NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })),
  requireSumulaLeitura: async () => (acesso.leitura === 'ok' ? null : NextResponse.json({ error: 'Entre para abrir a súmula.' }, { status: 401 })),
})
stub('../src/lib/arbitro-access', {
  requireArbitroPartidaAccess: async () =>
    acesso.escrita === 'ok' ? { auth: { userId: 'apontador-1' }, partida: PARTIDA } : NextResponse.json({ error: 'Sem permissão.' }, { status: 403 }),
})

let dados: Record<string, LinhaEscrita[]>
function preparar(semTabela = false) {
  dados = {
    Liga: [{ id: 1, status: 'EM_ANDAMENTO' }],
    Jogador: [
      { id: 11, equipeId: 1, nome: 'Fulano', banido: false },
      { id: 31, equipeId: 2, nome: 'Beltrano', banido: false },
    ],
    ...(semTabela ? {} : { ScoutAcao: [] }),
  }
  banco.atual = criarBancoEscrita(dados, { unicos: { ScoutAcao: [['partidaId', 'clientEventId']] }, idsNumericos: ['ScoutAcao'] }) as any
}

const ctx = (p: Record<string, string>): any => ({ params: Promise.resolve(p) })
const req = (metodo: string, caminho: string, corpo?: unknown) =>
  new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
const j = async (r: Response) => (await r.json()) as any

const BASE = { clientEventId: 'c-1', setNumero: 1, equipeId: 1, jogadorId: 11, fundamento: 'ATAQUE', resultado: 'PONTO', zonaOrigem: 4, zonaDestino: 6, rotacao: 2, placarA: 3, placarB: 2 }

async function main() {
  const lista = await import('../src/app/api/scout/[token]/acoes/route')
  const um = await import('../src/app/api/scout/[token]/acoes/[id]/route')
  const resumo = await import('../src/app/api/scout/[token]/resumo/route')
  const post = (c: unknown, token = 'tk') => lista.POST(req('POST', `/api/scout/${token}/acoes`, c), ctx({ token }))
  const get = (q = '') => lista.GET(req('GET', `/api/scout/tk/acoes${q}`), ctx({ token: 'tk' }))
  const del = (id: string) => um.DELETE(req('DELETE', `/api/scout/tk/acoes/${id}`), ctx({ token: 'tk', id }))

  // Flag desligada
  delete process.env.SCOUT_ATIVO
  preparar()
  assert.equal((await post(BASE)).status, 404)
  assert.equal((await get()).status, 404)
  assert.equal((await del('1')).status, 404)
  process.env.SCOUT_ATIVO = '1'

  // Permissão de escrita
  acesso.escrita = 'negado'
  assert.equal((await post(BASE)).status, 403)
  assert.equal((await del('1')).status, 403)
  acesso.escrita = 'ok'

  // Criação 201 e idempotência 200
  const c1 = await post(BASE)
  assert.equal(c1.status, 201)
  const a1 = (await j(c1)).data.acao
  assert.equal(a1.fundamento, 'ATAQUE')
  assert.equal(a1.equipe, 'A')
  assert.equal(dados.ScoutAcao![0]!.criadoPor, 'apontador-1')
  const c2 = await post(BASE)
  assert.equal(c2.status, 200)
  assert.deepEqual((await j(c2)).data.acao, a1)
  assert.equal(dados.ScoutAcao!.length, 1)

  // Validação
  assert.equal((await post({ ...BASE, clientEventId: 'c-2', fundamento: 'PRAIA' })).status, 400)
  assert.equal((await post({ ...BASE, clientEventId: 'c-2', setNumero: 6 })).status, 400)
  assert.equal((await post({ ...BASE, clientEventId: 'c-2', zonaOrigem: 10 })).status, 400)
  assert.equal((await post({ ...BASE, clientEventId: '' })).status, 400)
  assert.equal((await post({ ...BASE, clientEventId: 'c-2', resultado: 'X' })).status, 400)
  assert.equal((await lista.POST(new NextRequest('http://x/api', { method: 'POST', body: 'nao-json' }), ctx({ token: 'tk' }))).status, 400)
  // Equipe/jogador de fora
  assert.equal((await post({ ...BASE, clientEventId: 'c-3', equipeId: 9 })).status, 422)
  assert.equal((await post({ ...BASE, clientEventId: 'c-4', equipeId: 2, jogadorId: 11 })).status, 422, 'jogador de outra equipe')
  assert.equal((await post({ ...BASE, clientEventId: 'c-5', jogadorId: 999 })).status, 422, 'jogador inexistente')
  assert.equal(dados.ScoutAcao!.length, 1)

  // Sem jogador e da equipe B
  const cb = await post({ clientEventId: 'c-6', setNumero: 2, equipeId: 2, fundamento: 'SAQUE', resultado: 'ERRO' })
  assert.equal(cb.status, 201)
  assert.equal((await j(cb)).data.acao.equipe, 'B')

  // Listagem
  const todas = await j(await get())
  assert.equal(todas.data.length, 2)
  assert.equal((await j(await get('?set=2'))).data.length, 1)
  assert.equal((await get('?set=9')).status, 400)
  acesso.leitura = 'negado'
  assert.equal((await get()).status, 401)
  acesso.leitura = 'ok'

  // Anulação idempotente e fora da lista
  assert.equal((await del('abc')).status, 404)
  assert.equal((await del('999')).status, 404)
  const d1 = await del(String(a1.id))
  assert.equal(d1.status, 200)
  const anulada = (await j(d1)).data.acao
  assert.ok(anulada.anuladoEm)
  const d2 = await del(String(a1.id))
  assert.equal(d2.status, 200)
  assert.equal((await j(d2)).data.acao.anuladoEm, anulada.anuladoEm)
  assert.equal((await j(await get())).data.length, 1)
  // Reenvio da ação anulada continua devolvendo a mesma (não ressuscita)
  assert.equal((await post(BASE)).status, 200)
  assert.equal((await j(await get())).data.length, 1)

  // Campeonato finalizado bloqueia escrita
  dados.Liga![0]!.status = 'FINALIZADO'
  assert.equal((await post({ ...BASE, clientEventId: 'c-7' })).status, 409)
  dados.Liga![0]!.status = 'EM_ANDAMENTO'

  // Tabela ausente: 503
  preparar(true)
  const off = await post(BASE)
  assert.equal(off.status, 503)
  assert.equal((await j(off)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await get()).status, 503)
  assert.equal((await del('1')).status, 503)

  // Resumo inclui ações manuais (eventos desligados => 503 no resumo, mas a camada pura é testada abaixo)
  const { carregarAcoesScout, montarResumo, exportarCsv, VERSAO_ESQUEMA_CSV, VERSAO_ESQUEMA_JSON } = await import('../src/lib/scout')
  const { configMelhorDe3 } = await import('../src/lib/regras-volei')
  preparar()
  await post(BASE)
  await post({ ...BASE, clientEventId: 'c-8', fundamento: 'SAQUE', resultado: 'PONTO', jogadorId: 11 })
  await post({ ...BASE, clientEventId: 'c-9', fundamento: 'RECEPCAO', resultado: 'ERRO', equipeId: 2, jogadorId: 31 })
  await del('2')
  const carregadas = await carregarAcoesScout(banco.atual as any, { id: 100, equipeAId: 1, equipeBId: 2 })
  assert.equal(carregadas.ok, true)
  if (carregadas.ok) {
    assert.equal(carregadas.acoes.length, 2, 'anulada fora')
    const r = montarResumo({ partidaId: 100, log: [], config: configMelhorDe3(), acoes: carregadas.acoes, geradoEm: '2026-10-17T12:00:00.000Z' })
    assert.equal(r.versaoEsquema, 'scout-json-2')
    assert.equal(VERSAO_ESQUEMA_JSON, 'scout-json-2')
    assert.equal(VERSAO_ESQUEMA_CSV, 'scout-csv-2')
    assert.equal(r.estatisticas.porEquipe.find((e) => e.equipe === 'A')!.ataque.pontos, 1)
    assert.equal(r.estatisticas.porEquipe.find((e) => e.equipe === 'B')!.erros, 1)
    const csv = exportarCsv(r)
    assert.ok(csv.includes('acao_id;criado_em'))
    assert.equal(csv.split('\r\n').filter((l) => l.split(';')[2] === 'ACAO').length, 2)
  }
  const ausente = await carregarAcoesScout(criarBancoEscrita({}) as any, { id: 100, equipeAId: 1, equipeBId: 2 })
  assert.deepEqual(ausente, { ok: true, acoes: [] }, 'tabela ausente não derruba o resumo')
  void resumo

  console.log('scout-acoes.test.ts: ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
