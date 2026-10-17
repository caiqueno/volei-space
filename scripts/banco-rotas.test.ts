import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-banco-com-32-caracteres-ok'

const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

// Autenticação da súmula: stub controlado pelo teste (a lógica real é de outro módulo e não é alterada).
const apontador: { modo: 'ok' | 'negado' } = { modo: 'ok' }
function stub(caminho: string, exports: Record<string, unknown>) {
  const resolvido = require.resolve(caminho)
  require.cache[resolvido] = { id: resolvido, filename: resolvido, loaded: true, exports } as unknown as NodeJS.Module
}
stub('../src/lib/sumula-access', {
  requireSumulaTokenAccess: async (token: string) => (token === 'sumula-token-100' ? { partida: { id: 100 } } : NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })),
})
stub('../src/lib/arbitro-access', {
  requireArbitroPartidaAccess: async () =>
    apontador.modo === 'ok'
      ? { auth: { userId: 'apontador-1' }, partida: { id: 100 } }
      : NextResponse.json({ error: 'Você não está escalado para operar esta partida.' }, { status: 403 }),
})

const T1 = 'tokenEquipe1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const T2 = 'tokenEquipe2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const TEXP = 'tokenExpiradoCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
const TREV = 'tokenRevogadoDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'

function tabelas(): Record<string, LinhaEscrita[]> {
  const jogadores = (equipeId: number, base: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: base + i, equipeId, nome: `Atleta ${equipeId}-${i + 1}`, numero: i + 1, banido: false,
      cpf: '111.222.333-44', telefone: '(11) 99999-0000', dataNascimento: '2000-01-01',
    }))
  return {
    Liga: [{ id: 1, status: 'ATIVA' }],
    Partida: [{ id: 100, ligaId: 1, equipeAId: 1, equipeBId: 2, status: 'AGENDADA', sumulaToken: 'sumula-token-100', dataHora: null, setsPorA: 0, setsPorB: 0 }],
    Equipe: [{ id: 1, nome: 'Alfa' }, { id: 2, nome: 'Beta' }],
    SetPartida: [],
    Jogador: [...jogadores(1, 11), ...jogadores(2, 31)],
    SumulaPresenca: [],
    BancoAcesso: [],
    Papeleta: [],
    PedidoBanco: [],
  }
}

let dados: Record<string, LinhaEscrita[]>
async function preparar() {
  const { hashTokenBanco } = await import('../src/lib/banco/base')
  dados = tabelas()
  const futuro = new Date(Date.now() + 3_600_000).toISOString()
  const passado = new Date(Date.now() - 3_600_000).toISOString()
  dados.BancoAcesso.push(
    { id: 'a1', partidaId: 100, equipeId: 1, tokenHash: hashTokenBanco(T1), expiraEm: futuro, revogadoEm: null },
    { id: 'a2', partidaId: 100, equipeId: 2, tokenHash: hashTokenBanco(T2), expiraEm: futuro, revogadoEm: null },
    { id: 'a3', partidaId: 100, equipeId: 1, tokenHash: hashTokenBanco(TEXP), expiraEm: passado, revogadoEm: null },
    { id: 'a4', partidaId: 100, equipeId: 1, tokenHash: hashTokenBanco(TREV), expiraEm: futuro, revogadoEm: passado },
  )
  banco.atual = criarBancoEscrita(dados, { unicos: { Papeleta: [['partidaId', 'equipeId', 'setNumero']] } })
}

function req(metodo: string, caminho: string, corpo?: unknown, ip = '10.0.0.1') {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
const ctx = (p: Record<string, string>): any => ({ params: Promise.resolve(p) })
async function corpo(r: Response) {
  return (await r.json()) as any
}
const formacao = (ids: number[]) => ids.map((jogadorId, i) => ({ posicao: i + 1, jogadorId }))
const VALIDA = { formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 20, capitaoId: 11 }

async function main() {
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const visao = await import('../src/app/api/banco/[token]/route')
  const papeleta = await import('../src/app/api/banco/[token]/papeleta/[set]/route')
  const enviar = await import('../src/app/api/banco/[token]/papeleta/[set]/enviar/route')
  const pedidos = await import('../src/app/api/banco/[token]/pedidos/route')
  const pedido = await import('../src/app/api/banco/[token]/pedidos/[id]/route')
  const links = await import('../src/app/api/banco/links/route')
  const pendentes = await import('../src/app/api/sumula/[token]/pedidos-banco/route')
  const decidir = await import('../src/app/api/sumula/[token]/pedidos-banco/[id]/decidir/route')
  const papeletasSumula = await import('../src/app/api/sumula/[token]/papeleta/[set]/route')
  const aceitar = await import('../src/app/api/sumula/[token]/papeleta/[set]/[equipeId]/aceitar/route')

  const get = (t: string, ip?: string) => visao.GET(req('GET', `/api/banco/${t}`, undefined, ip), ctx({ token: t }))
  const put = (t: string, set: string, c: unknown) => papeleta.PUT(req('PUT', `/api/banco/${t}/papeleta/${set}`, c), ctx({ token: t, set }))
  const env = (t: string, set: string) => enviar.POST(req('POST', `/api/banco/${t}/papeleta/${set}/enviar`), ctx({ token: t, set }))
  const ped = (t: string, c: unknown) => pedidos.POST(req('POST', `/api/banco/${t}/pedidos`, c), ctx({ token: t }))
  const SUM = 'sumula-token-100'

  // 1. Flag desligada: tudo 404
  delete process.env.BANCO_APP_ATIVO
  await preparar()
  assert.equal((await get(T1)).status, 404)
  assert.equal((await put(T1, '1', VALIDA)).status, 404)
  assert.equal((await ped(T1, { tipo: 'TEMPO' })).status, 404)
  assert.equal((await links.POST(req('POST', '/api/banco/links', { partidaId: 100, equipeId: 1 }))).status, 404)
  assert.equal((await pendentes.GET(req('GET', '/x'), ctx({ token: SUM }))).status, 404)
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '1' }))).status, 404)
  process.env.BANCO_APP_ATIVO = '1'

  // 2. Sem tabelas: 503 com a mensagem combinada
  banco.atual = criarBancoEscrita({ Partida: [], Equipe: [], SetPartida: [], Jogador: [] })
  reiniciarCotas()
  const r503 = await get(T1)
  assert.equal(r503.status, 503)
  assert.equal((await corpo(r503)).error, 'Banco ainda não habilitado neste ambiente.')

  // 3. Token inválido, desconhecido, expirado, revogado
  await preparar()
  reiniciarCotas()
  assert.equal((await get('curto')).status, 404)
  assert.equal((await get('tokenDesconhecidoXXXXXXXXXXXXXXXXXXXXXXXXXXX')).status, 404)
  assert.equal((await get('1234567890123456789012345678901234567890')).status, 404)
  const exp = await get(TEXP)
  assert.equal(exp.status, 410)
  assert.equal((await corpo(exp)).codigo, 'LINK_EXPIRADO')
  assert.equal((await corpo(await get(TREV))).codigo, 'LINK_REVOGADO')
  assert.equal((await put(TREV, '1', VALIDA)).status, 410)

  // 4. Visão da equipe, sem PII
  const v = await get(T1)
  assert.equal(v.status, 200)
  const txt = JSON.stringify(await corpo(v))
  assert.ok(!/cpf|telefone|dataNascimento|111\.222|99999/.test(txt), 'sem PII')
  const vd = JSON.parse(txt).data
  assert.equal(vd.equipe.nome, 'Alfa')
  assert.equal(vd.elenco.length, 12)
  assert.deepEqual(Object.keys(vd.elenco[0]).sort(), ['jogadorId', 'nome', 'numero'])
  assert.deepEqual(vd.limites, { tempos: 2, substituicoes: 8 })
  assert.equal(vd.partida.equipeA.nome, 'Alfa')
  assert.ok(vd.elenco.every((j: any) => j.jogadorId < 31), 'só o elenco da própria equipe')

  // 5. Papeleta inválida devolve violações e não grava
  const dup = await put(T1, '1', { formacao: formacao([11, 11, 13, 14, 15, 16]) })
  assert.equal(dup.status, 422)
  const bd = await corpo(dup)
  assert.equal(bd.codigo, 'PAPELETA_INVALIDA')
  assert.ok(bd.violacoes.every((x: any) => /^RG-/.test(x.codigo) && x.mensagem))
  assert.equal(dados.Papeleta.length, 0)
  // jogador da outra equipe (isolamento)
  const outra = await put(T1, '1', { formacao: formacao([31, 12, 13, 14, 15, 16]) })
  assert.equal(outra.status, 422)
  assert.ok((await corpo(outra)).violacoes.some((x: any) => x.codigo === 'RG-FOR-009'))
  // líbero entre titulares / capitão fora de quadra
  assert.ok((await corpo(await put(T1, '1', { ...VALIDA, liberoId: 12 }))).violacoes.some((x: any) => x.codigo === 'RG-LIB-002'))
  const capForaDaRelacao = (await corpo(await put(T1, '1', { ...VALIDA, capitaoId: 99 }))).violacoes
  assert.ok(capForaDaRelacao.some((x: any) => x.codigo === 'RG-FOR-009' && x.categoria === 'FORMACAO'))
  assert.ok((await corpo(await put(T1, '1', { ...VALIDA, liberoId: 12 }))).violacoes.every((x: any) => x.categoria === 'ELENCO' || x.categoria === 'FORMACAO'))
  assert.equal(dados.Papeleta.length, 0)
  // corpo malformado e set inválido
  assert.equal((await put(T1, '1', { formacao: [] })).status, 400)
  assert.equal((await put(T1, '9', VALIDA)).status, 400)

  // 6. Salva o rascunho, regrava, envia e trava
  const salvo = await put(T1, '1', VALIDA)
  assert.equal(salvo.status, 200)
  assert.equal((await corpo(salvo)).data.papeleta.estado, 'RASCUNHO')
  assert.equal((await put(T1, '1', { ...VALIDA, capitaoId: 12 })).status, 200)
  assert.equal(dados.Papeleta.length, 1)
  assert.equal(dados.Papeleta[0].capitaoId, 12)
  // a outra equipe não enxerga nem envia a papeleta da primeira
  const v2 = (await corpo(await get(T2))).data
  assert.deepEqual(v2.papeletas, [])
  assert.equal((await env(T2, '1')).status, 404)
  // não envia o que não existe / set sem rascunho
  assert.equal((await env(T1, '2')).status, 404)
  const enviada = await env(T1, '1')
  assert.equal(enviada.status, 200)
  assert.equal((await corpo(enviada)).data.papeleta.estado, 'ENVIADA')
  assert.ok(dados.Papeleta[0].conteudoHash && dados.Papeleta[0].enviadaEm)
  const trava = await put(T1, '1', VALIDA)
  assert.equal(trava.status, 409)
  assert.equal((await corpo(trava)).codigo, 'PAPELETA_TRAVADA')
  assert.equal((await env(T1, '1')).status, 200, 'reenvio é idempotente')
  assert.equal(dados.Papeleta[0].capitaoId, 12, 'papeleta enviada não muda')

  // 7. Enviar exige papeleta válida (elenco mudou depois do rascunho)
  assert.equal((await put(T1, '2', VALIDA)).status, 200)
  dados.Jogador.find((j) => j.id === 12)!.numero = 1 // camisa repetida
  const invalida = await env(T1, '2')
  assert.equal(invalida.status, 422)
  assert.ok((await corpo(invalida)).violacoes.some((x: any) => x.codigo === 'RG-ELE-004'))
  dados.Jogador.find((j) => j.id === 12)!.numero = 2

  // 8. Set já iniciado não aceita edição
  dados.SetPartida.push({ partidaId: 100, numero: 1, pontosA: 25, pontosB: 20 })
  assert.equal((await put(T1, '3', VALIDA)).status, 200, 'set 3 ainda não começou')
  const iniciado = await put(T2, '1', { formacao: formacao([31, 32, 33, 34, 35, 36]) })
  assert.equal(iniciado.status, 409)
  assert.equal((await corpo(iniciado)).codigo, 'SET_INICIADO')
  dados.SetPartida.length = 0

  // 9. Pedidos
  const desafio = await ped(T1, { tipo: 'DESAFIO' })
  assert.equal(desafio.status, 501)
  assert.equal((await corpo(desafio)).error, 'Desafio de vídeo é uma fase posterior.')
  assert.equal((await ped(T1, { tipo: 'OUTRO' })).status, 400)
  assert.equal((await ped(T1, { tipo: 'SUBSTITUICAO', sai: 11 })).status, 422)
  const tempo = await ped(T1, { tipo: 'TEMPO' })
  assert.equal(tempo.status, 201)
  const idTempo = (await corpo(tempo)).data.pedido.id as string
  assert.ok(idTempo)
  // cancelar: outra equipe não enxerga (isolamento), a dona cancela, repetir é idempotente
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), ctx({ token: T2, id: idTempo }))).status, 404)
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), ctx({ token: T1, id: idTempo }))).status, 200)
  assert.equal(dados.PedidoBanco.find((p) => p.id === idTempo)!.estado, 'CANCELADO')
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), ctx({ token: T1, id: idTempo }))).status, 200)

  // 10. Limite de tempos com pedidos ACEITOS
  for (let i = 0; i < 2; i += 1) dados.PedidoBanco.push({ id: `ac${i}`, partidaId: 100, equipeId: 1, tipo: 'TEMPO', estado: 'ACEITO', payload: { setNumero: 1 } })
  const alem = await ped(T1, { tipo: 'TEMPO' })
  assert.equal(alem.status, 422)
  assert.equal((await corpo(alem)).violacoes[0].codigo, 'RG-TMP-001')
  assert.equal((await ped(T2, { tipo: 'TEMPO' })).status, 201, 'limite é por equipe')
  // substituição: cria, e uma segunda pendente na mesma interrupção é recusada
  const sub = await ped(T1, { tipo: 'SUBSTITUICAO', sai: 11, entra: 17 })
  assert.equal(sub.status, 201)
  const idSub = (await corpo(sub)).data.pedido.id as string
  assert.equal((await ped(T1, { tipo: 'SUBSTITUICAO', sai: 12, entra: 18 })).status, 422)

  // 11. Lado do apontador
  apontador.modo = 'negado'
  assert.equal((await pendentes.GET(req('GET', '/x'), ctx({ token: SUM }))).status, 403)
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: idSub }))).status, 403)
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '1' }))).status, 403)
  assert.equal((await papeletasSumula.GET(req('GET', '/x'), ctx({ token: SUM, set: '1' }))).status, 403)
  assert.equal(dados.PedidoBanco.find((p) => p.id === idSub)!.estado, 'PENDENTE')
  apontador.modo = 'ok'
  assert.equal((await pendentes.GET(req('GET', '/x'), ctx({ token: 'token-errado' }))).status, 404)

  const lista = await corpo(await pendentes.GET(req('GET', '/x'), ctx({ token: SUM })))
  assert.ok(lista.data.pedidos.length >= 2)
  assert.ok(lista.data.pedidos.every((p: any) => p.estado === 'PENDENTE'))
  assert.deepEqual([...new Set(lista.data.pedidos.map((p: any) => p.equipeId))].sort(), [1, 2])

  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'TALVEZ' }), ctx({ token: SUM, id: idSub }))).status, 400)
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: 'inexistente' }))).status, 404)
  const aceito = await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: idSub }))
  assert.equal(aceito.status, 200)
  const linhaSub = dados.PedidoBanco.find((p) => p.id === idSub)!
  assert.equal(linhaSub.estado, 'ACEITO')
  assert.equal(linhaSub.decididoPor, 'apontador-1')
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: idSub }))).status, 200, 'repetição idempotente')
  const conflito = await decidir.POST(req('POST', '/x', { decisao: 'RECUSADO' }), ctx({ token: SUM, id: idSub }))
  assert.equal(conflito.status, 409)
  // pedido já decidido não pode ser cancelado pelo banco
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), ctx({ token: T1, id: idSub }))).status, 409)
  // tempo aceito além do limite (corrida): recusa a aceitação
  dados.PedidoBanco.push({ id: '00000000-0000-4000-8000-0000000000e1', partidaId: 100, equipeId: 1, tipo: 'TEMPO', estado: 'PENDENTE', payload: { setNumero: 1 } })
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: '00000000-0000-4000-8000-0000000000e1' }))).status, 422)
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'RECUSADO' }), ctx({ token: SUM, id: '00000000-0000-4000-8000-0000000000e1' }))).status, 200)

  // 12. Papeletas no apontador
  const duas = await corpo(await papeletasSumula.GET(req('GET', '/x'), ctx({ token: SUM, set: '1' })))
  assert.equal(duas.data.papeletas.length, 1, 'só as enviadas aparecem')
  assert.equal(duas.data.papeletas[0].equipeNome, 'Alfa')
  assert.ok(!/cpf|telefone|11\.222/.test(JSON.stringify(duas)))
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '2' }))).status, 404, 'equipe 2 não enviou')
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '2', equipeId: '1' }))).status, 409, 'rascunho não é aceitável')
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '7' }))).status, 404)
  const ok = await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '1' }))
  assert.equal(ok.status, 200)
  assert.equal(dados.Papeleta.find((p) => p.setNumero === 1)!.estado, 'ACEITA')
  assert.equal(dados.Papeleta.find((p) => p.setNumero === 1)!.aceitaPor, 'apontador-1')
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '1' }))).status, 200)
  assert.equal((await put(T1, '1', VALIDA)).status, 409, 'aceita também é imutável')

  // 13. Geração e revogação de links
  const gerar = (c: unknown) => links.POST(req('POST', '/api/banco/links', c))
  apontador.modo = 'negado'
  const negado = await gerar({ partidaId: 100, equipeId: 1 })
  assert.equal(negado.status, 404, 'sem permissão = mesma 404 de partida inexistente')
  const inexistente = await gerar({ partidaId: 999, equipeId: 1 })
  assert.deepEqual(await corpo(negado), await corpo(inexistente))
  const listaNegada = await links.GET(req('GET', '/api/banco/links?partidaId=100'))
  assert.equal(listaNegada.status, 404)
  assert.equal((await links.DELETE(req('DELETE', '/api/banco/links?acessoId=a1'))).status, 404, 'id que não é uuid')
  apontador.modo = 'ok'
  assert.equal((await gerar({ partidaId: 100 })).status, 400)
  assert.equal((await gerar({ partidaId: 999, equipeId: 1 })).status, 404)
  assert.equal((await gerar({ partidaId: 100, equipeId: 5 })).status, 422)
  const antes = dados.BancoAcesso.length
  const criado = await gerar({ partidaId: 100, equipeId: 2 })
  assert.equal(criado.status, 201)
  const { url, expiraEm, acessoId } = (await corpo(criado)).data
  assert.ok(expiraEm && url.includes('/banco/'))
  const tokenNovo = url.split('/banco/')[1] as string
  assert.equal(dados.BancoAcesso.length, antes + 1)
  const linha = dados.BancoAcesso[dados.BancoAcesso.length - 1]!
  assert.ok(!JSON.stringify(linha).includes(tokenNovo), 'o token não é gravado, só o hash')
  assert.equal(linha.criadoPor, 'apontador-1')
  assert.equal(acessoId, linha.id, 'POST devolve o acessoId')
  // Listagem: sem token, com acessoId e datas; partidaId inválido = 400
  const listada = await links.GET(req('GET', '/api/banco/links?partidaId=100'))
  assert.equal(listada.status, 200)
  const itens = (await corpo(listada)).data as any[]
  assert.ok(itens.some((i) => i.acessoId === acessoId && i.equipeId === 2 && i.expiraEm && i.revogadoEm === null))
  assert.deepEqual(Object.keys(itens[0]).sort(), ['acessoId', 'criadoEm', 'equipeId', 'expiraEm', 'revogadoEm'])
  assert.ok(!JSON.stringify(itens).includes(tokenNovo) && !JSON.stringify(itens).includes('tokenHash'))
  assert.equal((await links.GET(req('GET', '/api/banco/links?partidaId=abc'))).status, 400)
  assert.equal((await links.GET(req('GET', '/api/banco/links?partidaId=999'))).status, 404)
  assert.equal((await get(tokenNovo)).status, 200)
  const revogar = await links.DELETE(req('DELETE', `/api/banco/links?acessoId=${linha.id}`))
  assert.equal(revogar.status, 200)
  assert.equal((await get(tokenNovo)).status, 410)
  assert.equal((await links.DELETE(req('DELETE', '/api/banco/links?acessoId=nao-existe'))).status, 404)
  assert.equal((await links.DELETE(req('DELETE', '/api/banco/links?acessoId=00000000-0000-4000-8000-0000000000aa'))).status, 404)
  // DELETE também tem rate limit
  reiniciarCotas()
  let ultimoDel = 404
  for (let i = 0; i < 35; i += 1) ultimoDel = (await links.DELETE(req('DELETE', '/api/banco/links?acessoId=00000000-0000-4000-8000-0000000000aa', undefined, '10.7.7.7'))).status
  assert.equal(ultimoDel, 429)
  // Pedido com id malformado: 404, não 500
  assert.equal((await pedido.DELETE(req('DELETE', '/x'), ctx({ token: T1, id: 'p;drop' }))).status, 404)
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'ACEITO' }), ctx({ token: SUM, id: 'nao-uuid' }))).status, 404)

  // 13b. Campeonato finalizado: decidir pedido e aceitar papeleta recusam (409), como eventos, scout e desafios
  dados.Liga![0]!.status = 'FINALIZADO'
  const pendenteFinal = '00000000-0000-4000-8000-0000000000e2'
  dados.PedidoBanco.push({ id: pendenteFinal, partidaId: 100, equipeId: 1, tipo: 'TEMPO', estado: 'PENDENTE', payload: { setNumero: 1 } })
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'RECUSADO' }), ctx({ token: SUM, id: pendenteFinal }))).status, 409)
  assert.equal(dados.PedidoBanco.find((p) => p.id === pendenteFinal)!.estado, 'PENDENTE')
  assert.equal((await aceitar.POST(req('POST', '/x'), ctx({ token: SUM, set: '1', equipeId: '1' }))).status, 409)
  dados.Liga![0]!.status = 'ATIVA'
  assert.equal((await decidir.POST(req('POST', '/x', { decisao: 'RECUSADO' }), ctx({ token: SUM, id: pendenteFinal }))).status, 200)

  // 14. Rate limit por IP
  reiniciarCotas()
  // O IP é consumido UMA vez por requisição: 120 requisições (60 por token) passam, a 121ª é 429.
  for (let i = 0; i < 120; i += 1) assert.equal((await get(i % 2 ? T1 : T2, '10.9.9.9')).status, 200, `requisição ${i + 1}`)
  assert.equal((await get(T1, '10.9.9.9')).status, 429)
  assert.equal((await get(T1, '10.8.8.8')).status, 200, 'outro IP segue livre')
  // Token malformado não cria balde por token, mas continua limitado por IP
  assert.equal((await get('curto', '10.8.8.8')).status, 404)

  // IP: cabeçalhos da infraestrutura vencem o x-forwarded-for (que o cliente consegue preencher)
  const { ipDaRequisicao } = await import('../src/lib/rate-limit')
  const h = (o: Record<string, string>) => ({ headers: new Headers(o) })
  assert.equal(ipDaRequisicao(h({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '1.1.1.1' })), '1.1.1.1')
  assert.equal(ipDaRequisicao(h({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '1.1.1.1', 'x-vercel-forwarded-for': '2.2.2.2' })), '2.2.2.2')
  assert.equal(ipDaRequisicao(h({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' })), '6.6.6.6')
  assert.equal(ipDaRequisicao(h({})), 'desconhecido')

  console.log('banco-rotas: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
