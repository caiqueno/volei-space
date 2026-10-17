import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-desafio-com-32-caracteres-ok'

const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const acesso: { escrita: 'ok' | 'negado'; leitura: 'ok' | 'negado' } = { escrita: 'ok', leitura: 'ok' }
function stub(caminho: string, exports: Record<string, unknown>) {
  const resolvido = require.resolve(caminho)
  require.cache[resolvido] = { id: resolvido, filename: resolvido, loaded: true, exports } as unknown as NodeJS.Module
}
const PARTIDA = { id: 100, ligaId: 1, equipeAId: 1, equipeBId: 2, status: 'EM_ANDAMENTO' }
stub('../src/lib/sumula-access', {
  requireSumulaTokenAccess: async (token: string) => (token === 'sumula-token-100' ? { partida: PARTIDA } : NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })),
  requireSumulaLeitura: async () => (acesso.leitura === 'ok' ? null : NextResponse.json({ error: 'Entre para abrir a súmula.' }, { status: 401 })),
})
stub('../src/lib/arbitro-access', {
  requireArbitroPartidaAccess: async () =>
    acesso.escrita === 'ok' ? { auth: { userId: 'apontador-1' }, partida: PARTIDA } : NextResponse.json({ error: 'Sem permissão.' }, { status: 403 }),
})

let dados: Record<string, LinhaEscrita[]>
function preparar(opcoes: { semDesafio?: boolean } = {}) {
  dados = {
    Liga: [{ id: 1, status: 'EM_ANDAMENTO' }],
    Partida: [{ id: 100, ligaId: 1, equipeAId: 1, equipeBId: 2, status: 'EM_ANDAMENTO', sumulaToken: 'sumula-token-100', setsPorA: 0, setsPorB: 0 }],
    Equipe: [{ id: 1, nome: 'Alfa' }, { id: 2, nome: 'Beta' }],
    SetPartida: [],
    Jogador: [],
    SumulaPresenca: [],
    BancoAcesso: [],
    Papeleta: [],
    PedidoBanco: [],
    ...(opcoes.semDesafio ? {} : { DesafioVideo: [] }),
  }
  banco.atual = criarBancoEscrita(dados) as any
}

const ctx = (p: Record<string, string>): any => ({ params: Promise.resolve(p) })
const req = (metodo: string, caminho: string, corpo?: unknown, ip = '10.0.0.1') =>
  new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
const j = async (r: Response) => (await r.json()) as any
const SUM = 'sumula-token-100'

async function main() {
  const modelo = await import('../src/lib/desafio')
  const lista = await import('../src/app/api/sumula/[token]/desafios/route')
  const decidirRota = await import('../src/app/api/sumula/[token]/desafios/[id]/decidir/route')

  // --- Regras puras
  assert.equal(modelo.limiteDesafiosPorSet({}), modelo.LIMITE_DESAFIOS_POR_SET_PADRAO, 'sem configuração usa o padrão [M], não confirmado')
  assert.equal(modelo.limiteDesafiosPorSet({ DESAFIO_LIMITE_POR_SET: '3' }), 3)
  assert.equal(modelo.limiteDesafiosPorSet({ DESAFIO_LIMITE_POR_SET: '0' }), 2)
  assert.equal(modelo.limiteDesafiosPorSet({ DESAFIO_LIMITE_POR_SET: 'abc' }), 2)
  assert.equal(modelo.desafioAtivo({}), false)
  assert.equal(modelo.desafioAtivo({ DESAFIO_ATIVO: '1' }), true)
  assert.equal(modelo.validarLinkVideo(undefined).ok, true)
  assert.deepEqual(modelo.validarLinkVideo('  '), { ok: true, valor: null })
  assert.deepEqual(modelo.validarLinkVideo('https://exemplo.com/v?id=1'), { ok: true, valor: 'https://exemplo.com/v?id=1' })
  assert.equal(modelo.validarLinkVideo('http://exemplo.com/v').ok, true)
  for (const ruim of ['ftp://x.com/a', 'javascript:alert(1)', 'data:text/html,x', 'https://user:senha@x.com/a', 'https://user@x.com/a', 'nao e url', 'exemplo.com/v', 'https://' + 'a'.repeat(500) + '.com', 'https://x.com/a b']) {
    assert.equal(modelo.validarLinkVideo(ruim).ok, false, ruim)
  }
  assert.equal(modelo.validarLinkVideo(123).ok, false)
  assert.equal(modelo.resolverDecisao('EM_ANALISE', 'MANTIDA'), 'APLICAR')
  assert.equal(modelo.resolverDecisao('SOLICITADO', 'CANCELADO'), 'APLICAR')
  assert.equal(modelo.resolverDecisao('MANTIDA', 'MANTIDA'), 'IDEMPOTENTE')
  assert.equal(modelo.resolverDecisao('MANTIDA', 'REVERTIDA'), 'CONFLITO')
  assert.equal(modelo.desafiosUsados([{ estado: 'MANTIDA' }, { estado: 'REVERTIDA' }, { estado: 'CANCELADO' }, { estado: 'EM_ANALISE' }]), 2)

  const post = (c: unknown) => lista.POST(req('POST', `/api/sumula/${SUM}/desafios`, c), ctx({ token: SUM }))
  const get = () => lista.GET(req('GET', `/api/sumula/${SUM}/desafios`), ctx({ token: SUM }))
  const decidir = (id: string, c: unknown) => decidirRota.POST(req('POST', `/x`, c), ctx({ token: SUM, id }))
  const D = { setNumero: 1, equipeId: 1, motivo: 'Bola na linha', linkVideo: 'https://exemplo.com/lance' }

  // --- Flag desligada
  delete process.env.DESAFIO_ATIVO
  preparar()
  assert.equal((await post(D)).status, 404)
  assert.equal((await get()).status, 404)
  assert.equal((await decidir('x', { decisao: 'MANTIDA' })).status, 404)
  process.env.DESAFIO_ATIVO = '1'
  process.env.DESAFIO_LIMITE_POR_SET = '2' // configuração explícita do teste; o padrão [M] não é regra oficial

  // --- Permissão
  acesso.escrita = 'negado'
  assert.equal((await post(D)).status, 403)
  assert.equal((await decidir('x', { decisao: 'MANTIDA' })).status, 403)
  acesso.escrita = 'ok'
  acesso.leitura = 'negado'
  assert.equal((await get()).status, 401)
  acesso.leitura = 'ok'

  // --- Criação e validações
  const c1 = await post(D)
  assert.equal(c1.status, 201)
  const d1 = (await j(c1)).data.desafio
  assert.equal(d1.estado, 'SOLICITADO')
  assert.equal(d1.linkVideo, 'https://exemplo.com/lance')
  assert.equal(await post({ ...D, linkVideo: 'javascript:alert(1)' }).then((r) => r.status), 400)
  assert.equal(await post({ ...D, linkVideo: 'https://a:b@x.com/' }).then((r) => r.status), 400)
  assert.equal(await post({ ...D, setNumero: 6 }).then((r) => r.status), 400)
  assert.equal(await post({ ...D, motivo: 'x'.repeat(301) }).then((r) => r.status), 400)
  assert.equal(await post({ ...D, equipeId: 9 }).then((r) => r.status), 422, 'equipe fora da partida')
  assert.equal(await post({ setNumero: 1 }).then((r) => r.status), 400)
  assert.equal((await lista.POST(new NextRequest('http://x/api', { method: 'POST', body: 'nao-json' }), ctx({ token: SUM }))).status, 400)
  const semOpcionais = await post({ setNumero: 1, equipeId: 2 })
  assert.equal(semOpcionais.status, 201)
  assert.equal((await j(semOpcionais)).data.desafio.linkVideo, null)

  // --- Limite (padrão 2 por equipe por set): equipe 1 tem 1; mais um cabe, o terceiro não
  assert.equal((await post({ ...D, motivo: 'segundo' })).status, 201)
  const terceiro = await post(D)
  assert.equal(terceiro.status, 422)
  assert.equal((await j(terceiro)).codigo, 'LIMITE_EXCEDIDO')
  assert.equal(dados.DesafioVideo!.filter((l) => l.equipeId === 1).length, 2)
  // Outro set e outra equipe têm o próprio limite
  assert.equal((await post({ ...D, setNumero: 2 })).status, 201)
  assert.equal((await post({ setNumero: 1, equipeId: 2 })).status, 201)
  // Limite configurável
  process.env.DESAFIO_LIMITE_POR_SET = '3'
  assert.equal((await post(D)).status, 201)
  assert.equal((await post(D)).status, 422)
  process.env.DESAFIO_LIMITE_POR_SET = '2' // configuração explícita do teste; o padrão [M] não é regra oficial

  // --- Decisão
  const todos = (await j(await get())).data as any[]
  assert.ok(todos.length >= 5)
  assert.equal((await decidir(d1.id, { decisao: 'XPTO' })).status, 400)
  assert.equal((await decidir(d1.id, {})).status, 400)
  assert.equal((await decidir('inexistente', { decisao: 'MANTIDA' })).status, 404)
  assert.equal((await decidir('a b', { decisao: 'MANTIDA' })).status, 404)
  const m1 = await decidir(d1.id, { decisao: 'MANTIDA' })
  assert.equal(m1.status, 200)
  assert.equal((await j(m1)).data.desafio.estado, 'MANTIDA')
  assert.equal(dados.DesafioVideo!.find((l) => l.id === d1.id)!.decididoPor, 'apontador-1')
  const m2 = await decidir(d1.id, { decisao: 'MANTIDA' })
  assert.equal(m2.status, 200, 'mesma decisão é idempotente')
  assert.equal((await decidir(d1.id, { decisao: 'REVERTIDA' })).status, 409, 'decisão contrária')
  assert.equal((await decidir(d1.id, { decisao: 'CANCELADO' })).status, 409)

  // Reverter devolve o desafio: a equipe 1 do set 1 (2 + 1 extra cancelado? ver contagem) volta a ter vaga
  const outrosDaEquipe = (await j(await get())).data.filter((t: any) => t.equipeId === 1 && t.setNumero === 1 && t.id !== d1.id && t.estado === 'SOLICITADO')
  assert.equal(outrosDaEquipe.length, 2, 'MANTIDA + 2 abertos = 3 usados (limite 2 estourado por causa do teste com limite 3)')
  assert.equal((await post(D)).status, 422, 'ainda sem vaga')
  assert.equal((await decidir(outrosDaEquipe[0].id, { decisao: 'REVERTIDA' })).status, 200)
  assert.equal((await post(D)).status, 422, 'MANTIDA + 1 aberto = 2: sem vaga')
  assert.equal((await decidir(outrosDaEquipe[1].id, { decisao: 'CANCELADO' })).status, 200)
  assert.equal((await post(D)).status, 201, 'REVERTIDA e CANCELADO não contam')

  // --- INCONCLUSIVA (R7): decisão final que NÃO consome o desafio, como REVERTIDA
  const daEquipe2 = (await j(await get())).data.find((t: any) => t.equipeId === 2 && t.setNumero === 1 && t.estado === 'SOLICITADO')
  assert.ok(daEquipe2)
  const inc = await decidir(daEquipe2.id, { decisao: 'INCONCLUSIVA' })
  assert.equal(inc.status, 200)
  assert.equal((await j(inc)).data.desafio.estado, 'INCONCLUSIVA')
  assert.equal((await decidir(daEquipe2.id, { decisao: 'INCONCLUSIVA' })).status, 200, 'idempotente')
  assert.equal((await decidir(daEquipe2.id, { decisao: 'MANTIDA' })).status, 409, 'já decidido')
  assert.equal((await post({ setNumero: 1, equipeId: 2 })).status, 201, 'INCONCLUSIVA não conta no limite')
  assert.equal((await post({ setNumero: 1, equipeId: 2 })).status, 422)
  // id malformado ou inexistente: 404, nunca 500
  assert.equal((await decidir('00000000-0000-4000-8000-0000000000ff', { decisao: 'MANTIDA' })).status, 404)

  // --- Desafio de partida encerrada e campeonato finalizado
  dados.Liga![0]!.status = 'FINALIZADO'
  assert.equal((await post({ ...D, setNumero: 3 })).status, 409)
  dados.Liga![0]!.status = 'EM_ANALISE'
  ;(PARTIDA as any).status = 'ENCERRADA'
  assert.equal((await post({ ...D, setNumero: 3 })).status, 409)
  ;(PARTIDA as any).status = 'EM_ANDAMENTO'

  // --- Tabela ausente: 503
  preparar({ semDesafio: true })
  const off = await post(D)
  assert.equal(off.status, 503)
  assert.equal((await j(off)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await get()).status, 503)
  assert.equal((await decidir('00000000-0000-4000-8000-0000000000d1', { decisao: 'MANTIDA' })).status, 503)

  // --- App de banco: DESAFIO deixa de ser 501 e vira pedido PENDENTE; aceite cria o desafio EM_ANALISE
  const { hashTokenBanco } = await import('../src/lib/banco/base')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const pedidos = await import('../src/app/api/banco/[token]/pedidos/route')
  const decidirPedido = await import('../src/app/api/sumula/[token]/pedidos-banco/[id]/decidir/route')
  const T1 = 'tokenEquipe1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const T2 = 'tokenEquipe2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
  const prepararBanco = (semDesafio = false) => {
    preparar({ semDesafio })
    dados.BancoAcesso!.push(
      { id: 'a1', partidaId: 100, equipeId: 1, tokenHash: hashTokenBanco(T1), expiraEm: new Date(Date.now() + 3_600_000).toISOString(), revogadoEm: null },
      { id: 'a2', partidaId: 100, equipeId: 2, tokenHash: hashTokenBanco(T2), expiraEm: new Date(Date.now() + 3_600_000).toISOString(), revogadoEm: null },
    )
    reiniciarCotas()
  }
  const ped = (t: string, c: unknown) => pedidos.POST(req('POST', `/api/banco/${t}/pedidos`, c), ctx({ token: t }))
  const dec = (id: string, c: unknown) => decidirPedido.POST(req('POST', '/x', c), ctx({ token: SUM, id }))
  process.env.BANCO_APP_ATIVO = '1'

  // Flag do desafio desligada: segue 501
  delete process.env.DESAFIO_ATIVO
  prepararBanco()
  assert.equal((await ped(T1, { tipo: 'DESAFIO' })).status, 501)
  process.env.DESAFIO_ATIVO = '1'

  prepararBanco()
  const pb = await ped(T1, { tipo: 'DESAFIO', motivo: 'Toque na rede', linkVideo: 'https://exemplo.com/v/1' })
  assert.equal(pb.status, 201)
  const pedido = (await j(pb)).data.pedido
  assert.equal(pedido.tipo, 'DESAFIO')
  assert.equal(pedido.estado, 'PENDENTE')
  assert.equal(dados.DesafioVideo!.length, 0, 'o desafio só nasce no aceite')
  assert.equal((await ped(T1, { tipo: 'DESAFIO', linkVideo: 'javascript:x' })).status, 400)
  assert.equal((await ped(T1, { tipo: 'DESAFIO' })).status, 409, 'um pedido pendente por set')

  const rec = await dec(pedido.id, { decisao: 'RECUSADO' })
  assert.equal(rec.status, 200)
  assert.equal(dados.DesafioVideo!.length, 0, 'recusa não cria desafio')

  const p2 = (await j(await ped(T1, { tipo: 'DESAFIO', motivo: 'Toque na rede', linkVideo: 'https://exemplo.com/v/1' }))).data.pedido
  const ac = await dec(p2.id, { decisao: 'ACEITO' })
  assert.equal(ac.status, 200)
  const corpoAc = await j(ac)
  assert.equal(corpoAc.data.pedido.estado, 'ACEITO')
  assert.equal(corpoAc.data.desafio.estado, 'EM_ANALISE')
  assert.equal(corpoAc.data.desafio.pedidoBancoId, p2.id)
  assert.equal(corpoAc.data.desafio.linkVideo, 'https://exemplo.com/v/1')
  assert.equal(corpoAc.data.desafio.equipeId, 1)
  assert.equal(dados.DesafioVideo!.length, 1)
  // Repetir o aceite não duplica
  const ac2 = await dec(p2.id, { decisao: 'ACEITO' })
  assert.equal(ac2.status, 200)
  assert.equal(dados.DesafioVideo!.length, 1)
  assert.equal((await dec(p2.id, { decisao: 'RECUSADO' })).status, 409)
  // O apontador decide o desafio criado
  assert.equal((await decidir(corpoAc.data.desafio.id, { decisao: 'REVERTIDA' })).status, 200)

  // Limite no aceite: equipe 2 chega a 2 desafios; o pedido seguinte é recusado já no pedido
  for (let i = 0; i < 2; i += 1) {
    const p = (await j(await ped(T2, { tipo: 'DESAFIO' }))).data.pedido
    assert.equal((await dec(p.id, { decisao: 'ACEITO' })).status, 200)
  }
  const cheio = await ped(T2, { tipo: 'DESAFIO' })
  assert.equal(cheio.status, 422)
  assert.equal((await j(cheio)).codigo, 'LIMITE_EXCEDIDO')

  // Aceite com limite estourado entre o pedido e a decisão
  prepararBanco()
  const pa = (await j(await ped(T1, { tipo: 'DESAFIO' }))).data.pedido
  dados.DesafioVideo!.push(
    { id: 'x1', partidaId: 100, setNumero: 1, equipeId: 1, estado: 'EM_ANALISE' },
    { id: 'x2', partidaId: 100, setNumero: 1, equipeId: 1, estado: 'MANTIDA' },
  )
  const estourado = await dec(pa.id, { decisao: 'ACEITO' })
  assert.equal(estourado.status, 422)
  assert.equal(dados.PedidoBanco!.find((p) => p.id === pa.id)!.estado, 'PENDENTE', 'pedido continua pendente')

  // Tabela do desafio ausente: 503 no pedido, e o pedido não muda
  prepararBanco(true)
  const semTab = await ped(T1, { tipo: 'DESAFIO' })
  assert.equal(semTab.status, 503)
  assert.equal((await j(semTab)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal(dados.PedidoBanco!.length, 0)

  // TEMPO continua funcionando como antes
  prepararBanco()
  assert.equal((await ped(T1, { tipo: 'TEMPO' })).status, 201)

  console.log('desafio.test.ts: ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
