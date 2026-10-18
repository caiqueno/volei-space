import assert from 'node:assert/strict'
import { scoutAtivo } from '../src/lib/scout-ui/flag'
import { montarCorrecao, montarPayload, motivoNaoPodeLancar, novoClientEventId } from '../src/lib/scout-ui/payload'
import {
  chaveFila,
  destinoDaResposta,
  destinoDoItem,
  enfileirar,
  enfileirarCorrecao,
  requisicaoDoItem,
  gravarFila,
  gravarMinhas,
  interpretarFila,
  LIMITE_FILA,
  lerFila,
  lerMinhas,
  planoDesfazer,
  proximoParaEnviar,
  recuoFila,
  registrarFalha,
  registrarMinha,
  remover,
  textoPausaFila,
  textoPendentes,
  type Armazenamento,
} from '../src/lib/scout-ui/fila'
import { GRADE_ZONAS, LEGENDA_QUADRA, NOTA_ZONAS_COBRAV } from '../src/lib/scout-ui/zonas'
import {
  acaoDaResposta,
  acoesDaResposta,
  classificarFalhaScout,
  descreverAcao,
  equipesDaPartida,
  estatisticaDaEquipe,
  filtrarAcoes,
  linhasResumo,
  textoContextoAcao,
} from '../src/lib/scout-ui/textos'
import { agregarAcoes } from '../src/lib/scout/estatisticas'
import type { AcaoScout } from '../src/lib/scout/modelo'
import type { AcaoServidor, PayloadAcao } from '../src/lib/scout-ui/tipos'

let total = 0
function caso(nome: string, fn: () => void) {
  total += 1
  try {
    fn()
    console.log(`  ok  ${nome}`)
  } catch (e) {
    console.error(`  FALHOU  ${nome}`)
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}

const base = { clientEventId: 'u1', setNumero: 1, equipeId: 10, jogadorId: 5, fundamento: 'ATAQUE', resultado: 'PONTO' } as const
const pay = (id: string): PayloadAcao => ({ clientEventId: id, setNumero: 1, equipeId: 10, fundamento: 'SAQUE', resultado: 'PONTO' })

caso('flag só liga com "1"', () => {
  assert.equal(scoutAtivo('1'), true)
  for (const v of [undefined, null, '', '0', 'true', ' 1']) assert.equal(scoutAtivo(v), false)
})

caso('payload mínimo e completo', () => {
  assert.deepEqual(montarPayload({ ...base, jogadorId: null }), { clientEventId: 'u1', setNumero: 1, equipeId: 10, fundamento: 'ATAQUE', resultado: 'PONTO' })
  const p = montarPayload({ ...base, zonaOrigem: 4, zonaDestino: 9, rotacao: 2, placarA: 10, placarB: 0 })
  assert.deepEqual(p, { ...base, zonaOrigem: 4, zonaDestino: 9, rotacao: 2, placarA: 10, placarB: 0 })
})

caso('payload ignora zonas e rotação fora do domínio e exige o essencial', () => {
  const p = montarPayload({ ...base, zonaOrigem: 0, zonaDestino: 10, rotacao: 7, placarA: -1 })
  assert.equal(p?.zonaOrigem, undefined)
  assert.equal(p?.zonaDestino, undefined)
  assert.equal(p?.rotacao, undefined)
  assert.equal(p?.placarA, undefined)
  assert.equal(montarPayload({ ...base, fundamento: null }), null)
  assert.equal(montarPayload({ ...base, resultado: null }), null)
  assert.equal(montarPayload({ ...base, equipeId: null }), null)
  assert.equal(montarPayload({ ...base, setNumero: 6 }), null)
  assert.equal(montarPayload({ ...base, clientEventId: '' }), null)
  assert.match(motivoNaoPodeLancar({ ...base, fundamento: null }) ?? '', /fundamento/)
  assert.equal(motivoNaoPodeLancar(base), null)
})

caso('clientEventId é uuid v4 e único, com ou sem crypto', () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  assert.match(novoClientEventId(), re)
  assert.match(novoClientEventId(null), re)
  assert.match(novoClientEventId({ getRandomValues: (a) => a.fill(255) }), re)
  assert.equal(novoClientEventId({ randomUUID: () => 'fixo' }), 'fixo')
  assert.notEqual(novoClientEventId(null), novoClientEventId(null))
})

caso('fila: enfileirar não duplica e respeita o limite', () => {
  let f = enfileirar([], pay('a'), 100)
  f = enfileirar(f, pay('a'), 200)
  assert.equal(f.length, 1)
  for (let i = 0; i < LIMITE_FILA + 5; i += 1) f = enfileirar(f, pay(`x${i}`), 0)
  assert.equal(f.length, LIMITE_FILA)
  assert.equal(f[f.length - 1]!.payload.clientEventId, `x${LIMITE_FILA + 4}`)
})

caso('fila: recuo exponencial com teto e reenvio só da frente', () => {
  assert.equal(recuoFila(0), 2000)
  assert.equal(recuoFila(1), 4000)
  assert.equal(recuoFila(20), 60000)
  let f = enfileirar(enfileirar([], pay('a'), 0), pay('b'), 0)
  assert.equal(proximoParaEnviar(f, 0)?.payload.clientEventId, 'a')
  f = registrarFalha(f, 'a', 1000)
  assert.equal(f[0]!.tentativas, 1)
  assert.equal(f[0]!.proximaEm, 3000)
  assert.equal(proximoParaEnviar(f, 2999), null)
  assert.equal(proximoParaEnviar(f, 3000)?.payload.clientEventId, 'a')
  assert.deepEqual(remover(f, 'a').map((i) => i.payload.clientEventId), ['b'])
})

caso('fila: destino por status', () => {
  assert.equal(destinoDaResposta(201), 'enviada')
  assert.equal(destinoDaResposta(409), 'enviada')
  assert.equal(destinoDaResposta(null), 'tentar-de-novo')
  assert.equal(destinoDaResposta(500), 'tentar-de-novo')
  assert.equal(destinoDaResposta(429), 'tentar-de-novo')
  assert.equal(destinoDaResposta(422), 'descartar')
  assert.equal(destinoDaResposta(400), 'descartar')
})

caso('fila: 401/403/404 pausam sem descartar; só 400/422 descartam', () => {
  for (const s of [401, 403, 404, 410]) assert.equal(destinoDaResposta(s), 'pausar')
  assert.equal(textoPausaFila(401), 'Sessão expirada: entre de novo, suas ações continuam salvas.')
  assert.equal(textoPausaFila(403), 'Sessão expirada: entre de novo, suas ações continuam salvas.')
  assert.match(textoPausaFila(404), /link/i)
  assert.match(textoPausaFila(404), /continuam salvas/)
})

caso('zonas: grade segue a convenção da rede (4-3-2 / 7-8-9 / 5-6-1)', () => {
  assert.deepEqual(GRADE_ZONAS.map((l) => [...l]), [[4, 3, 2], [7, 8, 9], [5, 6, 1]])
  assert.deepEqual([...GRADE_ZONAS.flat()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.match(LEGENDA_QUADRA, /rede em cima, vista da equipe que defende/i)
  assert.match(NOTA_ZONAS_COBRAV, /COBRAV/)
})

caso('fila: leitura tolera lixo, duplicata e armazenamento quebrado', () => {
  assert.deepEqual(interpretarFila(null), [])
  assert.deepEqual(interpretarFila('{nao json'), [])
  assert.deepEqual(interpretarFila('{"a":1}'), [])
  const bruto = JSON.stringify([{ payload: pay('a'), tentativas: 2, proximaEm: 5 }, { payload: pay('a') }, { payload: { x: 1 } }, null])
  const f = interpretarFila(bruto)
  assert.equal(f.length, 1)
  assert.equal(f[0]!.tentativas, 2)
  const quebrado: Armazenamento = {
    getItem() {
      throw new Error('bloqueado')
    },
    setItem() {
      throw new Error('cheio')
    },
  }
  assert.deepEqual(lerFila(quebrado, 't'), [])
  assert.equal(gravarFila(quebrado, 't', []), false)
  assert.equal(gravarFila(null, 't', []), false)
  assert.deepEqual(lerMinhas(quebrado, 't'), [])
  assert.equal(gravarMinhas(quebrado, 't', []), false)
})

caso('fila: grava e relê no armazenamento, por token', () => {
  const m = new Map<string, string>()
  const arm: Armazenamento = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
  const f = enfileirar([], pay('a'), 7)
  assert.equal(gravarFila(arm, 'tok', f), true)
  assert.deepEqual(lerFila(arm, 'tok'), f)
  assert.deepEqual(lerFila(arm, 'outro'), [])
  assert.ok(m.has(chaveFila('tok')))
})

caso('textos de pendentes', () => {
  assert.equal(textoPendentes(0), 'Tudo enviado')
  assert.equal(textoPendentes(1), '1 pendente')
  assert.equal(textoPendentes(3), '3 pendentes')
})

caso('desfazer: pendente primeiro, depois a última gravada, senão nada', () => {
  const f = enfileirar([], pay('p1'), 0)
  const minhas = registrarMinha(registrarMinha([], { id: 1, clientEventId: 'a' }), { id: 2, clientEventId: 'b' })
  assert.deepEqual(planoDesfazer(f, minhas), { tipo: 'cancelar-pendente', clientEventId: 'p1' })
  assert.deepEqual(planoDesfazer([], minhas), { tipo: 'apagar-no-servidor', id: 2, clientEventId: 'b' })
  assert.deepEqual(planoDesfazer([], []), { tipo: 'nada' })
  assert.equal(registrarMinha(minhas, { id: 2, clientEventId: 'b' }).length, 2)
})

caso('classificação das falhas e flag de estados', () => {
  assert.equal(classificarFalhaScout(404), 'desligado')
  assert.equal(classificarFalhaScout(503), 'nao-habilitado')
  assert.equal(classificarFalhaScout(403), 'token-invalido')
  assert.equal(classificarFalhaScout(400), 'token-invalido')
  assert.equal(classificarFalhaScout(null), 'rede')
  assert.equal(classificarFalhaScout(500), 'erro')
})

const partida = {
  data: {
    equipeAId: 10,
    equipeBId: 20,
    equipeA: { nome: 'Alfa', jogadores: [{ id: 2, nome: 'Bia', numero: 9 }, { id: 1, nome: 'Ana', numero: 3 }, { nome: 'sem id' }] },
    equipeB: { nome: 'Beta', jogadores: [{ id: 7, nome: 'Cris', numero: null }] },
  },
}

caso('equipes: lê elenco, ordena por camisa e ignora entradas inválidas', () => {
  const e = equipesDaPartida(partida)
  assert.equal(e.length, 2)
  assert.deepEqual(e[0]!.jogadores.map((j) => j.id), [1, 2])
  assert.equal(e[1]!.jogadores[0]!.numero, null)
  assert.deepEqual(equipesDaPartida(null), [])
  assert.deepEqual(equipesDaPartida({ data: { equipeA: { nome: 'x' } } }), [])
})

const a1: AcaoServidor = { id: 1, setNumero: 1, equipeId: 10, jogadorId: 1, fundamento: 'ATAQUE', resultado: 'PONTO', zonaDestino: 4 }
const a2: AcaoServidor = { id: 2, setNumero: 2, equipeId: 20, jogadorId: null, fundamento: 'SAQUE', resultado: 'ERRO' }
const a3: AcaoServidor = { id: 3, setNumero: 1, equipeId: 20, jogadorId: 7, fundamento: 'RECEPCAO', resultado: 'CONTINUA' }

caso('descrição da ação nunca usa nome, só camisa', () => {
  const e = equipesDaPartida(partida)
  assert.equal(descreverAcao(a1, e), 'Camisa 3: Ataque, Ponto, zona 4')
  assert.equal(descreverAcao(a2, e), 'Beta: Saque, Erro')
  assert.equal(descreverAcao(a3, e), 'Camisa -: Recepção, Continua')
  assert.ok(!descreverAcao(a1, e).includes('Ana'))
})

caso('filtro por set e equipe, mais recente primeiro, com limite', () => {
  const todas = [a1, a2, a3]
  assert.deepEqual(filtrarAcoes(todas, { set: 'todos', equipeId: 'todas' }).map((a) => a.id), [3, 2, 1])
  assert.deepEqual(filtrarAcoes(todas, { set: 1, equipeId: 'todas' }).map((a) => a.id), [3, 1])
  assert.deepEqual(filtrarAcoes(todas, { set: 1, equipeId: 20 }).map((a) => a.id), [3])
  assert.deepEqual(filtrarAcoes(todas, { set: 'todos', equipeId: 'todas' }, 2).map((a) => a.id), [3, 2])
})

caso('respostas: lista, ação criada e formatos inesperados', () => {
  assert.equal(acoesDaResposta({ data: [a1, { x: 1 }] }).length, 1)
  assert.equal(acoesDaResposta({ data: { acoes: [a1] } }).length, 1)
  assert.deepEqual(acoesDaResposta(null), [])
  assert.equal(acaoDaResposta({ data: { acao: a1 } })?.id, 1)
  assert.equal(acaoDaResposta({ data: {} }), null)
})

caso('resumo: sem dado quando não há denominador e valores com dado', () => {
  assert.deepEqual(linhasResumo(null).map((l) => l.valor), ['sem dado', 'sem dado', '0'])
  const acoes: AcaoScout[] = [
    ['ATAQUE', 'PONTO'], ['ATAQUE', 'ERRO'], ['ATAQUE', 'PONTO'], ['ATAQUE', 'CONTINUA'],
    ['RECEPCAO', 'PONTO'], ['RECEPCAO', 'ERRO'], ['SAQUE', 'PONTO'],
  ].map(([f, r], i) => ({ id: i + 1, set: 1, pontoA: 0, pontoB: 0, equipe: 'A', jogadorId: null, fundamento: f, resultado: r, rotacao: null, posicao: null, zonaOrigem: null, zonaDestino: null, origem: 'MANUAL' }) as AcaoScout)
  const json = { data: { estatisticas: agregarAcoes(acoes) } }
  const l = linhasResumo(estatisticaDaEquipe(json, 'A'))
  assert.equal(l[0]!.valor, '25% (4 ataques)')
  assert.equal(l[1]!.valor, '50% (2 recepções)')
  assert.equal(l[2]!.valor, '1')
  assert.equal(estatisticaDaEquipe(json, 'B'), null)
  assert.equal(estatisticaDaEquipe({}, 'A'), null)
})

const acaoSrv = (p: Partial<AcaoServidor> = {}): AcaoServidor => ({ id: 41, setNumero: 2, equipeId: 10, jogadorId: 5, fundamento: 'ATAQUE', resultado: 'CONTINUA', zonaOrigem: 4, zonaDestino: null, ...p })

caso('montarCorrecao: só os campos alterados; nada alterado vira null', () => {
  const a = acaoSrv()
  const igual = { jogadorId: 5, fundamento: 'ATAQUE', resultado: 'CONTINUA', zonaOrigem: 4, zonaDestino: null } as const
  assert.equal(montarCorrecao(a, igual), null)
  assert.deepEqual(montarCorrecao(a, { ...igual, resultado: 'PONTO', zonaDestino: 9 }), { resultado: 'PONTO', zonaDestino: 9 })
  assert.deepEqual(montarCorrecao(a, { ...igual, jogadorId: 6, fundamento: 'BLOQUEIO' }), { fundamento: 'BLOQUEIO', jogadorId: 6 })
  assert.equal(montarCorrecao(a, { ...igual, zonaOrigem: 12 }), null)
})

caso('correção entra na fila como PATCH idempotente (um item por ação, campos juntados)', () => {
  const a = acaoSrv()
  const f1 = enfileirarCorrecao([], a, { resultado: 'PONTO' }, 1000)!
  assert.equal(f1.length, 1)
  assert.deepEqual(requisicaoDoItem(f1[0]!), { metodo: 'PATCH', resto: '/acoes/41', corpo: { resultado: 'PONTO' } })
  const f2 = enfileirarCorrecao(f1, a, { zonaDestino: 2, resultado: 'ERRO' }, 2000)!
  assert.equal(f2.length, 1)
  assert.deepEqual(f2[0]!.correcao?.campos, { resultado: 'ERRO', zonaDestino: 2 })
  // vive junto de ação nova (POST) sem misturar
  const nova = enfileirar(f2, { clientEventId: 'n1', setNumero: 1, equipeId: 10, fundamento: 'SAQUE', resultado: 'PONTO' }, 3000)
  assert.equal(requisicaoDoItem(nova[1]!).metodo, 'POST')
  assert.equal(enfileirarCorrecao([], acaoSrv({ equipeId: undefined }), { resultado: 'PONTO' }, 1), null)
  assert.equal(enfileirarCorrecao([], a, {}, 1), null)
})

caso('fila com correção sobrevive ao armazenamento; destino de PATCH 404/410 descarta o item, sem pausar', () => {
  const f = enfileirarCorrecao([], acaoSrv(), { resultado: 'PONTO' }, 1)!
  const lida = interpretarFila(JSON.stringify(f))
  assert.deepEqual(lida[0]!.correcao, { acaoId: 41, campos: { resultado: 'PONTO' } })
  assert.equal(destinoDoItem(lida[0]!, 404), 'descartar')
  assert.equal(destinoDoItem(lida[0]!, 410), 'descartar')
  assert.equal(destinoDoItem(lida[0]!, 200), 'enviada')
  assert.equal(destinoDoItem(lida[0]!, 400), 'descartar')
  assert.equal(destinoDoItem(lida[0]!, 401), 'pausar')
  assert.equal(destinoDoItem(lida[0]!, null), 'tentar-de-novo')
  const post = enfileirar([], { clientEventId: 'n1', setNumero: 1, equipeId: 10, fundamento: 'SAQUE', resultado: 'PONTO' }, 1)[0]!
  assert.equal(destinoDoItem(post, 404), 'pausar')
})

caso('textoContextoAcao mostra rotação e placar só quando existem', () => {
  assert.equal(textoContextoAcao({}), '')
  assert.equal(textoContextoAcao({ rotacao: null, placarA: null, placarB: null }), '')
  assert.equal(textoContextoAcao({ rotacao: 3 }), 'rotação 3')
  assert.equal(textoContextoAcao({ rotacao: 3, placarA: 12, placarB: 10 }), 'rotação 3, placar 12 x 10')
  assert.equal(textoContextoAcao({ placarA: 0, placarB: 0 }), 'placar 0 x 0')
  assert.equal(textoContextoAcao({ placarA: 5 }), '')
})

console.log(`\nscout-ui: ${total} casos executados.`)
