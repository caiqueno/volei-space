// App de banco por SESSÃO (R14): flags, papéis, isolamento entre equipes, igualdade com o link por token e jogos da equipe.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-banco-sessao-com-32-caracteres'

const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const TIME_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TIME_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CAT = '11111111-1111-4111-8111-111111111111'
const T1 = 'tokenEquipe1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const T2 = 'tokenEquipe2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const hora = (deslocamentoMs: number) => new Date(Date.now() + deslocamentoMs).toISOString()

function tabelas(): Record<string, LinhaEscrita[]> {
  const jogadores = (equipeId: number, base: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: base + i, equipeId, nome: `Atleta ${equipeId}-${i + 1}`, numero: i + 1, banido: false,
      cpf: '111.222.333-44', telefone: '(11) 99999-0000', dataNascimento: '2000-01-01',
    }))
  const partida = (id: number, extras: Record<string, unknown>) => ({
    id, ligaId: 1, equipeAId: 1, equipeBId: 2, status: 'AGENDADA', categoriaCampeonatoId: CAT, dataHora: hora(3_600_000),
    localNome: 'Ginásio Central', setsPorA: 0, setsPorB: 0, ...extras,
  })
  return {
    Liga: [{ id: 1, nome: 'Copa Norte', status: 'ATIVA' }, { id: 2, nome: 'Copa Sul', status: 'ATIVA' }],
    CategoriaCampeonato: [{ id: CAT, ligaId: 1, nome: 'Adulto Feminino' }],
    Equipe: [{ id: 1, nome: 'Alfa' }, { id: 2, nome: 'Beta' }, { id: 3, nome: 'Gama' }],
    Partida: [
      partida(100, {}),
      partida(101, { dataHora: hora(-3 * 86_400_000), status: 'ENCERRADA' }), // passado
      partida(102, { status: 'CANCELADA' }),
      partida(103, { ligaId: 2 }), // outra liga: a equipe não está inscrita lá
      partida(104, { equipeBId: 3, dataHora: hora(86_400_000) }),
    ],
    SetPartida: [],
    Jogador: [...jogadores(1, 11), ...jogadores(2, 31)],
    SumulaPresenca: [],
    BancoAcesso: [],
    Papeleta: [],
    PedidoBanco: [],
    TimeClube: [{ id: TIME_A, nome: 'Equipe Alfa' }, { id: TIME_B, nome: 'Equipe Beta' }],
    Inscricao: [
      { id: 'i1', timeId: TIME_A, ligaId: 1, categoriaCampeonatoId: CAT, status: 'CONFIRMADA', equipeLegadoId: 1 },
      { id: 'i2', timeId: TIME_B, ligaId: 1, categoriaCampeonatoId: CAT, status: 'CONFIRMADA', equipeLegadoId: 2 },
    ],
    MembroEquipe: [
      { timeId: TIME_A, usuarioId: 'lider-a', papel: 'RESPONSAVEL' },
      { timeId: TIME_A, usuarioId: 'tec-a', papel: 'TECNICO' },
      { timeId: TIME_A, usuarioId: 'assist-a', papel: 'ASSISTENTE' },
      { timeId: TIME_A, usuarioId: 'cap-a', papel: 'CAPITAO' },
      { timeId: TIME_B, usuarioId: 'lider-b', papel: 'RESPONSAVEL' },
    ],
  }
}

let dados: Record<string, LinhaEscrita[]>
async function preparar(ajuste?: (t: Record<string, LinhaEscrita[]>) => void) {
  const { hashTokenBanco } = await import('../src/lib/banco/base')
  dados = tabelas()
  const futuro = hora(3_600_000)
  dados.BancoAcesso.push(
    { id: 'a1', partidaId: 100, equipeId: 1, tokenHash: hashTokenBanco(T1), expiraEm: futuro, revogadoEm: null },
    { id: 'a2', partidaId: 100, equipeId: 2, tokenHash: hashTokenBanco(T2), expiraEm: futuro, revogadoEm: null },
  )
  ajuste?.(dados)
  banco.atual = criarBancoEscrita(dados, { unicos: { Papeleta: [['partidaId', 'equipeId', 'setNumero']] } })
}

function req(metodo: string, caminho: string, corpo?: unknown) {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
const ctx = (p: Record<string, string>): any => ({ params: Promise.resolve(p) })
const json = async (r: Response) => (await r.json()) as any
const formacao = (ids: number[]) => ids.map((jogadorId, i) => ({ posicao: i + 1, jogadorId }))
const VALIDA = { formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 20, capitaoId: 11 }
const INVALIDA = { formacao: formacao([11, 12, 13, 14, 15, 15]), liberoId: 20, capitaoId: 11 }

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const como = async (userId: string, tipo: 'equipe' | 'organizador' = 'equipe') => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const porToken = {
    visao: await import('../src/app/api/banco/[token]/route'),
    papeleta: await import('../src/app/api/banco/[token]/papeleta/[set]/route'),
    pedidos: await import('../src/app/api/banco/[token]/pedidos/route'),
  }
  const visao = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/route')
  const papeleta = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]/route')
  const enviar = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/papeleta/[set]/enviar/route')
  const pedidos = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/pedidos/route')
  const pedido = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/pedidos/[id]/route')
  const jogos = await import('../src/app/api/meu-time/jogos/route')

  const P = (partidaId = '100', equipeId = '1', extra: Record<string, string> = {}) => ctx({ partidaId, equipeId, ...extra })
  const get = (partidaId?: string, equipeId?: string) => visao.GET(req('GET', '/x'), P(partidaId, equipeId))
  const put = (set: string, c: unknown, equipeId = '1') => papeleta.PUT(req('PUT', '/x', c), P('100', equipeId, { set }))
  const env = (set: string, equipeId = '1') => enviar.POST(req('POST', '/x'), P('100', equipeId, { set }))
  const ped = (c: unknown, equipeId = '1') => pedidos.POST(req('POST', '/x', c), P('100', equipeId))
  const verJogos = (timeId = TIME_A) => jogos.GET(req('GET', `/api/meu-time/jogos?equipeId=${timeId}`))

  // --- 1. Flags: cada uma desligada = 404, mesmo logado e membro -------------------------------------------------
  await preparar()
  await como('lider-a')
  const ligar = () => { process.env.BANCO_SESSAO_ATIVO = '1'; process.env.BANCO_APP_ATIVO = '1'; process.env.MEU_TIME_ATIVO = '1' }
  for (const flag of ['BANCO_SESSAO_ATIVO', 'BANCO_APP_ATIVO', 'MEU_TIME_ATIVO']) {
    ligar()
    delete process.env[flag]
    assert.equal((await get()).status, 404, `${flag} desligada: visão`)
    assert.equal((await put('1', VALIDA)).status, 404, `${flag} desligada: papeleta`)
    assert.equal((await env('1')).status, 404)
    assert.equal((await ped({ tipo: 'TEMPO' })).status, 404)
    assert.equal((await pedido.DELETE(req('DELETE', '/x'), P('100', '1', { id: 'a' }))).status, 404)
    assert.equal((await verJogos()).status, 404, `${flag} desligada: jogos`)
  }
  ligar()

  // --- 2. Autenticação ----------------------------------------------------------------------------------------------------
  reiniciarCotas()
  sessao.token = null
  assert.equal((await get()).status, 401)
  assert.equal((await verJogos()).status, 401)
  await como('lider-a', 'organizador')
  assert.equal((await get()).status, 401, 'só conta de equipe')

  // --- 3. Visão idêntica à do link por token ---------------------------------------------------------------------------------
  await como('lider-a')
  const sess = await get()
  assert.equal(sess.status, 200)
  const doToken = await porToken.visao.GET(req('GET', '/x'), ctx({ token: T1 }))
  assert.equal(doToken.status, 200)
  const dSess = await json(sess)
  const dTok = await json(doToken)
  assert.deepEqual(dSess, dTok, 'mesma visão do GET /api/banco/[token]')
  assert.ok(!/cpf|telefone|dataNascimento|111\.222|99999/.test(JSON.stringify(dSess)), 'sem PII')
  assert.equal(dSess.data.equipe.nome, 'Alfa')
  assert.ok(dSess.data.elenco.every((j: any) => j.jogadorId < 31), 'só o elenco da própria equipe')

  // --- 4. Isolamento: partidas e equipes -------------------------------------------------------------------------------------------
  assert.equal((await get('100', '2')).status, 404, 'líder de A não abre o banco de B')
  assert.equal((await put('1', VALIDA, '2')).status, 404)
  assert.equal((await ped({ tipo: 'TEMPO' }, '2')).status, 404)
  assert.equal((await get('100', '3')).status, 404, 'equipe que não joga a partida')
  assert.equal((await get('999', '1')).status, 404)
  assert.equal((await get('abc', '1')).status, 404)
  assert.equal((await get('100', '1x')).status, 404)
  assert.equal((await get('103', '1')).status, 404, 'inscrita na liga 1, partida da liga 2')
  await como('lider-b')
  assert.equal((await get('100', '1')).status, 404, 'líder de B não abre o banco de A')
  assert.equal((await get('100', '2')).status, 200)
  await como('estranho')
  assert.equal((await get()).status, 404, 'quem não é membro de nenhuma equipe = 404')
  assert.equal(dados.Papeleta.length, 0)
  assert.equal(dados.PedidoBanco.length, 0)

  // --- 5. Papéis --------------------------------------------------------------------------------------------------------------------------
  await como('assist-a')
  assert.equal((await get()).status, 200, 'assistente lê')
  const aPut = await put('1', VALIDA)
  assert.equal(aPut.status, 403, 'papeleta exige RESPONSAVEL ou TECNICO')
  assert.equal((await json(aPut)).codigo, 'SEM_PERMISSAO')
  assert.equal((await env('1')).status, 403)
  assert.equal((await ped({ tipo: 'TEMPO' })).status, 201, 'assistente pede tempo')
  assert.equal(dados.Papeleta.length, 0)
  await como('cap-a')
  assert.equal((await get()).status, 200, 'capitão lê')
  assert.equal((await put('1', VALIDA)).status, 403)
  assert.equal((await ped({ tipo: 'TEMPO' })).status, 403, 'capitão só lê')
  assert.equal(dados.PedidoBanco.length, 1)

  // --- 6. Papeleta e pedidos: mesma validação e mesmas respostas do token --------------------------------------------------------------------
  await como('lider-a')
  const sInv = await put('1', INVALIDA)
  assert.equal(sInv.status, 422)
  const tInv = await porToken.papeleta.PUT(req('PUT', '/x', INVALIDA), ctx({ token: T1, set: '1' }))
  assert.deepEqual(await json(sInv), await json(tInv), 'mesmas violações do motor')
  assert.equal((await put('9', VALIDA)).status, 400)
  assert.equal((await put('1', { formacao: [] })).status, 400)
  const sOk = await put('1', VALIDA)
  assert.equal(sOk.status, 200)
  assert.equal((await json(sOk)).data.papeleta.estado, 'RASCUNHO')
  assert.equal(dados.Papeleta.length, 1)
  await como('tec-a')
  const sEnv = await env('1')
  assert.equal(sEnv.status, 200, 'técnico envia')
  assert.equal((await json(sEnv)).data.papeleta.estado, 'ENVIADA')
  assert.equal((await env('1')).status, 200, 'reenvio idempotente')
  const travada = await put('1', VALIDA)
  assert.equal(travada.status, 409)
  assert.equal((await json(travada)).codigo, 'PAPELETA_TRAVADA')
  // O mesmo estado aparece na visão pelo token.
  const visaoToken = await json(await porToken.visao.GET(req('GET', '/x'), ctx({ token: T1 })))
  assert.equal(visaoToken.data.papeletas[0].estado, 'ENVIADA')
  // Pedidos: limite de 2 tempos por set (o assistente já pediu 1).
  await como('lider-a')
  const t2 = await ped({ tipo: 'TEMPO' })
  assert.equal(t2.status, 201)
  const t3 = await ped({ tipo: 'TEMPO' })
  assert.equal(t3.status, 422)
  const t3Token = await porToken.pedidos.POST(req('POST', '/x', { tipo: 'TEMPO' }), ctx({ token: T2 }))
  assert.equal(t3Token.status, 201, 'a equipe B ainda tem tempo; cada equipe tem o seu limite')
  assert.equal((await json(t3)).codigo, 'PEDIDO_INVALIDO')
  assert.equal((await ped({ tipo: 'XYZ' })).status, 400)
  const idPedido = (await json(t2)).data.pedido.id as string
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), P('100', '1', { id: 'nao-uuid' }))).status, 404)
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), P('100', '2', { id: idPedido }))).status, 404, 'equipe de B não cancela pedido de A')
  const cancelado = await pedido.DELETE(req('DELETE', '/x'), P('100', '1', { id: idPedido }))
  assert.equal(cancelado.status, 200)
  assert.equal((await json(cancelado)).data.pedido.estado, 'CANCELADO')
  await como('lider-b')
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), P('100', '2', { id: idPedido }))).status, 404, 'IDOR: pedido de outra equipe')

  // --- 7. Jogos da equipe ---------------------------------------------------------------------------------------------------------------------
  reiniciarCotas()
  await preparar()
  await como('lider-a')
  const lj = await verJogos()
  assert.equal(lj.status, 200)
  const jogosA = (await json(lj)).data as any[]
  assert.deepEqual(jogosA.map((j) => j.partidaId), [100, 104], 'hoje e futuros, sem passado, cancelado nem outra liga')
  assert.deepEqual(Object.keys(jogosA[0]).sort(), ['adversario', 'campeonato', 'categoria', 'equipeId', 'horario', 'local', 'papeletaPendente', 'partidaId', 'status'])
  assert.equal(jogosA[0].adversario, 'Beta')
  assert.equal(jogosA[0].equipeId, 1)
  assert.equal(jogosA[0].campeonato, 'Copa Norte')
  assert.equal(jogosA[0].categoria, 'Adulto Feminino')
  assert.equal(jogosA[0].local, 'Ginásio Central')
  assert.equal(jogosA[0].papeletaPendente, true)
  assert.equal(jogosA[1].adversario, 'Gama')
  assert.ok(!/cpf|telefone|dataNascimento|Atleta/.test(JSON.stringify(jogosA)), 'sem PII')
  // Depois de enviar a papeleta do set, deixa de estar pendente.
  assert.equal((await put('1', VALIDA)).status, 200)
  assert.equal((await env('1')).status, 200)
  assert.equal(((await json(await verJogos())).data as any[])[0].papeletaPendente, false)
  assert.equal(((await json(await verJogos())).data as any[])[1].papeletaPendente, true, 'outra partida segue pendente')
  // O líder de B só vê os jogos de B; o assistente de A vê os de A; estranho e equipe alheia = 404.
  await como('lider-b')
  assert.deepEqual(((await json(await verJogos(TIME_B))).data as any[]).map((j) => j.partidaId), [100])
  assert.equal(((await json(await verJogos(TIME_B))).data as any[])[0].adversario, 'Alfa')
  assert.equal((await verJogos(TIME_A)).status, 404)
  await como('assist-a')
  assert.equal((await verJogos(TIME_A)).status, 200)
  await como('estranho')
  assert.equal((await verJogos(TIME_A)).status, 404)
  assert.equal((await verJogos('nao-uuid')).status, 404)
  // Equipe sem inscrição com ponte para a partida: lista vazia (sem erro).
  await preparar((t) => { t.Inscricao.forEach((i) => { i.equipeLegadoId = null }) })
  await como('lider-a')
  assert.deepEqual((await json(await verJogos())).data, [])
  assert.equal((await get()).status, 404, 'sem a ponte equipe -> inscrição não há acesso')
  // Inscrição removida não dá acesso.
  await preparar((t) => { t.Inscricao[0].status = 'REMOVIDA' })
  assert.equal((await get()).status, 404)
  assert.deepEqual((await json(await verJogos())).data, [])

  // --- 8. Sem as tabelas: 503 ------------------------------------------------------------------------------------------------------------------------
  reiniciarCotas()
  await preparar((t) => { delete (t as any).Papeleta })
  const r503 = await get()
  assert.equal(r503.status, 503)
  assert.equal((await json(r503)).error, 'Banco ainda não habilitado neste ambiente.')
  assert.equal((await verJogos()).status, 503)
  await preparar((t) => { delete (t as any).Inscricao })
  assert.equal((await get()).status, 503)

  console.log('banco-sessao.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
