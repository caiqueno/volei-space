import assert from 'node:assert/strict'
import { IDS, bancoComTabelas, criarAmbiente } from './helpers/ambiente-elenco'

const amb = criarAmbiente()
const { req, json, entrar } = amb

const A = (n: number) => IDS.atleta(n)
const PASSADO = '2020-01-01T00:00:00.000Z'
const FUTURO = '2099-01-01T00:00:00.000Z'

async function main() {
  const livre = await import('../src/app/api/meu-time/inscricoes/[id]/atletas/route')
  const pedidos = await import('../src/app/api/meu-time/inscricoes/[id]/pedidos-troca/route')
  const pedidoId = await import('../src/app/api/meu-time/inscricoes/[id]/pedidos-troca/[pedidoId]/route')
  const orgLista = await import('../src/app/api/organizador/pedidos-troca/route')
  const orgDecidir = await import('../src/app/api/organizador/pedidos-troca/[id]/decidir/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')

  const trocaLivre = (corpo: unknown, id = IDS.INS1) => livre.PATCH(req('PATCH', `/api/meu-time/inscricoes/${id}/atletas`, corpo), { params: { id } })
  const criar = (corpo: unknown, id = IDS.INS1) => pedidos.POST(req('POST', `/api/meu-time/inscricoes/${id}/pedidos-troca`, corpo), { params: { id } })
  const listar = (id = IDS.INS1) => pedidos.GET(req('GET', `/api/meu-time/inscricoes/${id}/pedidos-troca`), { params: { id } })
  const cancelar = (pid: string, id = IDS.INS1) => pedidoId.DELETE(req('DELETE', `/api/meu-time/inscricoes/${id}/pedidos-troca/${pid}`), { params: { id, pedidoId: pid } })
  const listarOrg = (query = '') => orgLista.GET(req('GET', `/api/organizador/pedidos-troca${query}`))
  const decidir = (pid: string, corpo: unknown) => orgDecidir.POST(req('POST', `/api/organizador/pedidos-troca/${pid}/decidir`, corpo), { params: { id: pid } })

  process.env.MEU_TIME_ATIVO = '1'
  process.env.ELENCO_COMPLETO_ATIVO = '1'

  let ambiente = bancoComTabelas()
  const novo = (prazo: string | null, regraExtra: Record<string, unknown> = {}, opcoes = {}) => {
    ambiente = bancoComTabelas({
      RegraElenco: prazo === null && Object.keys(regraExtra).length === 0 ? [] : [{ categoriaCampeonatoId: IDS.CAT1, ligaId: 1, liberosMax: 2, documentosExigidos: [], prazoTrocaEm: prazo, ...regraExtra }],
    }, opcoes)
    amb.banco.atual = ambiente.banco
    reiniciarCotas()
    return ambiente
  }
  const ativos = () => ambiente.tabelas.InscricaoAtleta.filter((l) => l.inscricaoId === IDS.INS1 && l.ativo).map((l) => l.atletaId).sort()
  const linhaAtleta = (n: number) => ambiente.tabelas.InscricaoAtleta.filter((l) => l.atletaId === A(n))

  // --- Flag desligada: 404 em tudo que é novo --------------------------------------------
  novo(PASSADO)
  await entrar('lider')
  delete process.env.ELENCO_COMPLETO_ATIVO
  assert.equal((await criar({ sai: A(6), entra: A(7) })).status, 404)
  assert.equal((await listar()).status, 404)
  assert.equal((await trocaLivre({ sai: A(6), entra: A(7) })).status, 404)
  await entrar('org1', 'organizador')
  assert.equal((await listarOrg()).status, 404)
  assert.equal((await decidir(IDS.INS1, { decisao: 'APROVADO' })).status, 404)
  process.env.ELENCO_COMPLETO_ATIVO = '1'
  await entrar('lider')

  // --- Antes do prazo: lista livre; pedido não é necessário ---------------------------------
  novo(FUTURO)
  let r = await trocaLivre({ sai: A(6), entra: A(7) })
  assert.equal(r.status, 200)
  assert.deepEqual(ativos(), [A(1), A(2), A(3), A(4), A(5), A(7)].sort())
  assert.equal(linhaAtleta(7)[0].numero, 6, 'o que entra herda a camisa do que sai')
  assert.equal(linhaAtleta(6)[0].ativo, false)
  assert.ok(linhaAtleta(6)[0].removidoEm)
  r = await criar({ sai: A(5), entra: A(6) })
  assert.equal(r.status, 409, 'antes do prazo não precisa de pedido')
  assert.equal((await json(r)).codigo, 'PRAZO_ABERTO')
  assert.equal(ambiente.tabelas.PedidoTroca.length, 0)
  // Camisa explícita; camisa repetida é recusada pelas validações de elenco.
  assert.equal((await trocaLivre({ sai: A(5), entra: A(6), numero: 2 })).status, 422)
  assert.equal((await trocaLivre({ sai: A(5), entra: A(6), numero: 50 })).status, 200)
  assert.equal(linhaAtleta(6).find((l) => l.ativo)!.numero, 50)
  // Sem prazo definido a lista é sempre livre.
  novo(null)
  assert.equal((await trocaLivre({ sai: A(6), entra: A(7) })).status, 200)

  // --- Troca livre: validações e isolamento --------------------------------------------------
  novo(FUTURO)
  assert.equal((await trocaLivre({ sai: A(6), entra: IDS.atletaB })).status, 422, 'entra de outro clube')
  assert.equal((await trocaLivre({ sai: A(7), entra: A(8) })).status, 422, 'sai fora da lista')
  assert.equal((await trocaLivre({ sai: A(6), entra: A(5) })).status, 422, 'entra já na lista')
  assert.equal((await trocaLivre({ sai: A(6), entra: A(6) })).status, 422)
  assert.equal((await trocaLivre({ sai: 'x', entra: A(7) })).status, 422)
  assert.equal(ativos().length, 6, 'nada mudou')
  await entrar('outro')
  assert.equal((await trocaLivre({ sai: A(6), entra: A(7) })).status, 404, 'IDOR: inscrição de outra equipe')
  await entrar('assist')
  assert.equal((await trocaLivre({ sai: A(6), entra: A(7) })).status, 403)
  await entrar('lider')
  assert.equal((await trocaLivre({ sai: A(6), entra: A(7) }, '99999999-9999-4999-8999-999999999999')).status, 404)
  // Regra de elenco vale também na troca livre (idade).
  novo(FUTURO, { nascimentoDe: '2005-01-01' })
  r = await trocaLivre({ sai: A(6), entra: A(7) })
  assert.equal(r.status, 422)
  assert.equal((await json(r)).codigo, 'FORA_DA_IDADE')

  // --- Depois do prazo: troca só por pedido --------------------------------------------------
  novo(PASSADO)
  r = await trocaLivre({ sai: A(6), entra: A(7) })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'PRAZO_ENCERRADO')
  assert.deepEqual(ativos().length, 6)

  // Validações do pedido.
  assert.equal((await criar({ sai: A(6), entra: IDS.atletaB })).status, 422, 'entra precisa estar no banco do time')
  assert.equal((await criar({ sai: A(7), entra: A(8) })).status, 422, 'sai precisa estar na lista')
  assert.equal((await criar({ sai: A(6), entra: A(5) })).status, 422)
  assert.equal((await criar({ sai: A(6) })).status, 422)
  assert.equal(ambiente.tabelas.PedidoTroca.length, 0)

  r = await criar({ sai: A(6), entra: A(7), motivo: 'Lesão no joelho' })
  assert.equal(r.status, 201)
  let corpo = await json(r)
  assert.equal(corpo.data.estado, 'PENDENTE')
  assert.equal(corpo.data.sai.nome, 'Atleta 6')
  assert.equal(corpo.data.entra.nome, 'Atleta 7')
  assert.equal(corpo.data.motivo, 'Lesão no joelho')
  const pedido1 = corpo.data.id
  assert.equal(ambiente.tabelas.PedidoTroca[0].solicitadoPor, 'lider')
  assert.equal(ambiente.tabelas.PedidoTroca[0].tipo, 'SUBSTITUIR')
  assert.equal(ambiente.tabelas.PedidoTroca[0].justificativa, 'Lesão no joelho', 'motivo vai na coluna justificativa')
  assert.equal(ambiente.tabelas.PedidoTroca[0].motivo, undefined)
  assert.deepEqual(ativos().length, 6, 'o pedido não altera a lista')
  assert.ok(linhaAtleta(6)[0].ativo)

  r = await criar({ sai: A(6), entra: A(7) })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'PEDIDO_DUPLICADO')
  assert.equal(ambiente.tabelas.PedidoTroca.length, 1)

  // Listagem do líder (e do assistente em leitura); outra equipe não vê.
  corpo = await json(await listar())
  assert.equal(corpo.data.pedidos.length, 1)
  assert.equal(corpo.data.trocaLivre, false)
  await entrar('assist')
  assert.equal((await listar()).status, 200)
  assert.equal((await criar({ sai: A(5), entra: A(8) })).status, 403)
  await entrar('outro')
  assert.equal((await listar()).status, 404, 'IDOR na leitura')
  assert.equal((await criar({ sai: A(6), entra: A(7) })).status, 404)
  assert.equal((await cancelar(pedido1)).status, 404, 'IDOR no cancelamento')
  await entrar('lider')

  // Cancelar: só pendente, idempotente.
  r = await criar({ sai: A(5), entra: A(8) })
  const pedido2 = (await json(r)).data.id
  r = await cancelar(pedido2)
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.estado, 'CANCELADO')
  assert.equal((await cancelar(pedido2)).status, 200, 'repetir é idempotente')
  assert.equal((await cancelar('lixo')).status, 404)
  assert.equal((await cancelar('99999999-9999-4999-8999-999999999999')).status, 404)

  // --- Organizador: lista, filtro, isolamento --------------------------------------------------
  await entrar('org1', 'organizador')
  corpo = await json(await listarOrg())
  assert.equal(corpo.data.pedidos.length, 2)
  assert.equal(corpo.data.pedidos[0].equipe, 'Equipe A')
  assert.equal(corpo.data.pedidos[0].categoria, 'Adulto Feminino')
  corpo = await json(await listarOrg('?estado=PENDENTE'))
  assert.deepEqual(corpo.data.pedidos.map((p: any) => p.id), [pedido1])
  corpo = await json(await listarOrg('?estado=cancelado'))
  assert.deepEqual(corpo.data.pedidos.map((p: any) => p.id), [pedido2])
  assert.equal((await listarOrg('?estado=XPTO')).status, 422)
  await entrar('org2', 'organizador')
  corpo = await json(await listarOrg())
  assert.equal(corpo.data.pedidos.length, 0, 'outro organizador não vê pedidos alheios')
  assert.equal((await decidir(pedido1, { decisao: 'APROVADO' })).status, 404, 'IDOR na decisão')
  assert.equal((await decidir('lixo', { decisao: 'APROVADO' })).status, 404)
  await entrar('lider')
  assert.equal((await listarOrg()).status, 401)
  assert.equal((await decidir(pedido1, { decisao: 'APROVADO' })).status, 401)

  // Decisão inválida / pedido cancelado.
  await entrar('org1', 'organizador')
  assert.equal((await decidir(pedido1, { decisao: 'TALVEZ' })).status, 422)
  assert.equal((await decidir(pedido2, { decisao: 'APROVADO' })).status, 409, 'cancelado pela equipe')

  // --- APROVADO aplica a troca; idempotente; contrário = 409; notifica --------------------------
  r = await decidir(pedido1, { decisao: 'APROVADO' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.estado, 'APROVADO')
  assert.deepEqual(ativos(), [A(1), A(2), A(3), A(4), A(5), A(7)].sort(), 'troca aplicada na cópia da inscrição')
  assert.equal(linhaAtleta(7)[0].numero, 6)
  assert.equal(linhaAtleta(6)[0].ativo, false)
  assert.equal(linhaAtleta(7)[0].nomeSnapshot, 'Atleta 7')
  const guardado = ambiente.tabelas.PedidoTroca.find((l) => l.id === pedido1)!
  assert.equal(guardado.status, 'APROVADO')
  assert.equal(guardado.decididoPor, 'org1')
  assert.ok(guardado.decididoEm)
  const notificacoes = ambiente.tabelas.Notificacao.filter((l) => l.tipo === 'PEDIDO_TROCA_APROVADO')
  assert.equal(notificacoes.length, 1)
  assert.equal(notificacoes[0].usuarioId, 'lider')
  assert.ok(!JSON.stringify(notificacoes[0]).includes('Lesão'), 'sem dados sensíveis na notificação')
  assert.ok(ambiente.tabelas.Jogador.some((j) => j.nome === 'Atleta 7'), 'ponte para a equipe legada recebe o atleta que entrou')

  r = await decidir(pedido1, { decisao: 'APROVADO' })
  assert.equal(r.status, 200, 'idempotente')
  assert.equal(ativos().length, 6)
  assert.equal(linhaAtleta(7).length, 1, 'repetir não duplica a linha')
  assert.equal(ambiente.tabelas.Notificacao.filter((l) => l.tipo === 'PEDIDO_TROCA_APROVADO').length, 1, 'não notifica de novo')
  r = await decidir(pedido1, { decisao: 'RECUSADO', motivo: 'tarde demais' })
  assert.equal(r.status, 409, 'decisão contrária')
  assert.equal((await json(r)).codigo, 'PEDIDO_JA_DECIDIDO')
  await entrar('lider')
  assert.equal((await cancelar(pedido1)).status, 409, 'pedido decidido não cancela')

  // --- RECUSADO: não mexe na lista, guarda o motivo, notifica ------------------------------------
  r = await criar({ sai: A(5), entra: A(8), motivo: 'Troca de posição' })
  const pedido3 = (await json(r)).data.id
  await entrar('org1', 'organizador')
  r = await decidir(pedido3, { decisao: 'RECUSADO', motivo: 'Fora do regulamento' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.estado, 'RECUSADO')
  assert.equal(corpo.data.motivoRecusa, 'Fora do regulamento')
  assert.equal(ambiente.tabelas.PedidoTroca.find((l) => l.id === pedido3)!.motivoDecisao, 'Fora do regulamento')
  assert.ok(linhaAtleta(5)[0].ativo, 'lista intacta')
  const recusa = ambiente.tabelas.Notificacao.filter((l) => l.tipo === 'PEDIDO_TROCA_RECUSADO')
  assert.equal(recusa.length, 1)
  assert.match(recusa[0].mensagem, /Fora do regulamento/)
  assert.equal((await decidir(pedido3, { decisao: 'RECUSADO' })).status, 200, 'idempotente')
  assert.equal((await decidir(pedido3, { decisao: 'APROVADO' })).status, 409)
  assert.equal(ativos().length, 6)

  // --- Aprovação reaproveita as validações de elenco ------------------------------------------------
  novo(PASSADO)
  await entrar('lider')
  const pedido4 = (await json(await criar({ sai: A(6), entra: A(7) }))).data.id
  ambiente.tabelas.RegraElenco[0].nascimentoDe = '2005-01-01' // a regra mudou depois do pedido
  await entrar('org1', 'organizador')
  r = await decidir(pedido4, { decisao: 'APROVADO' })
  assert.equal(r.status, 422, 'atleta que entra ficou fora da regra')
  assert.equal((await json(r)).codigo, 'FORA_DA_IDADE')
  assert.equal(ambiente.tabelas.PedidoTroca[0].status, 'PENDENTE', 'o pedido continua pendente (dá para recusar)')
  assert.deepEqual(ativos().length, 6)
  assert.ok(linhaAtleta(6)[0].ativo)
  assert.equal((await decidir(pedido4, { decisao: 'RECUSADO' })).status, 200)

  // Camisa tomada por outro atleta depois do pedido.
  novo(PASSADO)
  await entrar('lider')
  const pedido5 = (await json(await criar({ sai: A(6), entra: A(7), numero: 9 }))).data.id
  assert.equal(ambiente.tabelas.PedidoTroca[0].numeroNovo, 9)
  linhaAtleta(1)[0].numero = 9 // outro atleta tomou a camisa depois do pedido
  await entrar('org1', 'organizador')
  r = await decidir(pedido5, { decisao: 'APROVADO' })
  assert.equal(r.status, 422)
  assert.equal((await json(r)).codigo, 'NUMERO_REPETIDO')

  // --- Falha no meio da aplicação: compensa e o pedido volta a pendente -----------------------------------
  novo(PASSADO, {}, { colunasAusentes: { InscricaoAtleta: ['documentosOk'] } })
  await entrar('lider')
  const pedido6 = (await json(await criar({ sai: A(6), entra: A(7) }))).data.id
  await entrar('org1', 'organizador')
  r = await decidir(pedido6, { decisao: 'APROVADO' })
  assert.ok([503, 500].includes(r.status))
  assert.ok(linhaAtleta(6)[0].ativo, 'quem saía foi reativado')
  assert.equal(linhaAtleta(6)[0].removidoEm, null)
  assert.equal(linhaAtleta(7).length, 0)
  assert.equal(ambiente.tabelas.PedidoTroca[0].status, 'PENDENTE', 'pedido revertido')
  assert.equal(ambiente.tabelas.PedidoTroca[0].decididoPor, null)

  // --- Decisões simultâneas: a troca acontece uma vez só -----------------------------------------------------
  novo(PASSADO)
  await entrar('lider')
  const pedido7 = (await json(await criar({ sai: A(6), entra: A(7) }))).data.id
  await entrar('org1', 'organizador')
  const [d1, d2] = await Promise.all([decidir(pedido7, { decisao: 'APROVADO' }), decidir(pedido7, { decisao: 'APROVADO' })])
  assert.deepEqual([d1.status, d2.status].sort(), [200, 200])
  assert.equal(linhaAtleta(7).length, 1)
  assert.equal(ativos().length, 6)

  // Campeonato finalizado: o organizador não decide e o líder não pede.
  novo(PASSADO)
  await entrar('lider')
  const pedido8 = (await json(await criar({ sai: A(6), entra: A(7) }))).data.id
  ambiente.tabelas.Liga.find((l) => l.id === 1)!.status = 'FINALIZADO'
  assert.equal((await criar({ sai: A(5), entra: A(8) })).status, 409)
  await entrar('org1', 'organizador')
  r = await decidir(pedido8, { decisao: 'APROVADO' })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'CAMPEONATO_FINALIZADO')

  // --- Tabela de pedidos ausente = 503 -------------------------------------------------------------------------
  amb.banco.atual = bancoComTabelas({ PedidoTroca: undefined, RegraElenco: [{ categoriaCampeonatoId: IDS.CAT1, ligaId: 1, liberosMax: 2, documentosExigidos: [], prazoTrocaEm: PASSADO }] }).banco
  await entrar('lider')
  r = await criar({ sai: A(6), entra: A(7) })
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await listar()).status, 503)
  await entrar('org1', 'organizador')
  assert.equal((await listarOrg()).status, 503)

  console.log('elenco-pedido-troca: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
