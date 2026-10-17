import {
  anexarEvento,
  avaliarExecucaoDoSaque,
  avaliarSancao,
  CONFIG_FIVB_MELHOR_DE_5,
  decidirFaltasDoRally,
  derivarPlacar,
  faltaDePosicaoPorSubstituicaoIlegal,
  jogadoresImpedidos,
  quadroResultadosWO,
  resolverSorteio,
  resolverWO,
  validarAlteracaoDeResultado,
  validarAlteracaoDeRelacao,
  validarAssinaturasDeAbertura,
  validarEntradaEmQuadra,
  validarEntregaDaPapeleta,
  validarPosicoesNoSaque,
  validarPresencaDaVencedoraNoWO,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type PosicaoNaQuadra,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

/*
 * Complementos de cobertura do 03: regras verificadas [V]/[G] que ainda não tinham caso de teste com o ID no nome.
 * Nada aqui fixa item [M] como oficial.
 */

const c5 = CONFIG_FIVB_MELHOR_DE_5
const CTX: ContextoDerivacao = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], B: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
}

class Jogo {
  log: readonly SumulaEvento[] = []
  private n = 0

  add<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K]): number {
    this.n += 1
    const r = anexarEvento(this.log, { tipo, payload, clientEventId: `e-${this.n}` } as NovoEvento)
    if (!r.ok) throw new Error(`${r.codigo}: ${r.mensagem}`)
    this.log = r.log
    return r.evento.seq
  }

  iniciarSet(numeroSet = 1, saqueInicial: Equipe = 'A'): void {
    this.add('SET_INICIADO', {
      numeroSet,
      formacaoA: [1, 2, 3, 4, 5, 6],
      formacaoB: [21, 22, 23, 24, 25, 26],
      saqueInicial,
    })
  }

  ponto(equipe: Equipe, vezes = 1): void {
    for (let i = 0; i < vezes; i += 1) this.add('PONTO', { equipe })
  }

  estado() {
    return derivarPlacar(this.log, c5, CTX)
  }
}

/* ------------------------------ RG-ELE-002 ------------------------------ */

caso('RG-ELE-002: depois da assinatura da relação nominal os jogadores registrados não mudam', () => {
  assert.equal(validarAlteracaoDeRelacao({ assinada: false, acao: 'TROCAR' }).ok, true)
  for (const acao of ['INCLUIR', 'REMOVER', 'TROCAR'] as const) {
    const r = validarAlteracaoDeRelacao({ assinada: true, acao })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.codigo, 'RG-ELE-002')
  }
})

caso('RG-ELE-002: só jogador registrado na relação assinada pode entrar em quadra', () => {
  assert.equal(validarEntradaEmQuadra({ relacao: [1, 2, 3], jogador: 2 }).ok, true)
  const r = validarEntradaEmQuadra({ relacao: [1, 2, 3], jogador: 99 })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-ELE-002')
})

/* ------------------------------ RG-FOR-001 ------------------------------ */

caso('RG-FOR-001: o vencedor do sorteio escolhe saque/recepção e o perdedor escolhe o lado', () => {
  const r = resolverSorteio({ vencedor: 'A', escolhaVencedor: { tipo: 'SAQUE' }, escolhaPerdedor: { tipo: 'LADO', lado: 'ESQUERDA' } })
  assert.ok(!('ok' in r))
  if ('primeiroSaque' in r) {
    assert.equal(r.primeiroSaque, 'A')
    assert.deepEqual(r.lado, { A: 'DIREITA', B: 'ESQUERDA' })
    assert.equal(r.escolhaPendente, null)
  }
  const recepcao = resolverSorteio({ vencedor: 'B', escolhaVencedor: { tipo: 'RECEPCAO' } })
  if ('primeiroSaque' in recepcao) {
    assert.equal(recepcao.primeiroSaque, 'A')
    assert.equal(recepcao.escolhaPendente, 'A') // o perdedor ainda escolhe o lado
  }
})

caso('RG-FOR-001: o vencedor que escolhe o lado deixa saque/recepção para o perdedor', () => {
  const r = resolverSorteio({ vencedor: 'A', escolhaVencedor: { tipo: 'LADO', lado: 'ESQUERDA' }, escolhaPerdedor: { tipo: 'RECEPCAO' } })
  if ('primeiroSaque' in r) {
    assert.equal(r.primeiroSaque, 'A') // B escolheu receber
    assert.deepEqual(r.lado, { A: 'ESQUERDA', B: 'DIREITA' })
  }
})

caso('RG-FOR-001: perdedor com a mesma escolha do vencedor é recusado', () => {
  const r = resolverSorteio({ vencedor: 'A', escolhaVencedor: { tipo: 'SAQUE' }, escolhaPerdedor: { tipo: 'RECEPCAO' } })
  assert.ok('ok' in r && r.ok === false)
  if ('ok' in r && !r.ok) assert.equal(r.codigo, 'RG-FOR-001')
})

/* ------------------------------ RG-FOR-004 ------------------------------ */

caso('RG-FOR-004: a papeleta é entregue antes do set, assinada (ou eletrônica) e com os 6 da relação nominal', () => {
  const base = { formacao: [1, 2, 3, 4, 5, 6], relacao: [1, 2, 3, 4, 5, 6, 7, 8], assinada: true, antesDoSet: true }
  assert.equal(validarEntregaDaPapeleta(base).ok, true)
  const semAssinatura = validarEntregaDaPapeleta({ ...base, assinada: false })
  assert.equal(semAssinatura.ok === false && semAssinatura.codigo, 'RG-FOR-004')
  const tarde = validarEntregaDaPapeleta({ ...base, antesDoSet: false })
  assert.equal(tarde.ok === false && tarde.codigo, 'RG-FOR-004')
  const repetido = validarEntregaDaPapeleta({ ...base, formacao: [1, 1, 3, 4, 5, 6] })
  assert.equal(repetido.ok === false && repetido.codigo, 'RG-FOR-005')
  const naoRegistrado = validarEntregaDaPapeleta({ ...base, formacao: [1, 2, 3, 4, 5, 99] })
  assert.equal(naoRegistrado.ok === false && naoRegistrado.codigo, 'RG-FOR-009')
})

/* ------------------------------ RG-SAQ-003 ------------------------------ */

caso('RG-SAQ-003: o saque sai em até 8 segundos do apito; antes do apito é repetido', () => {
  assert.equal(avaliarExecucaoDoSaque({ sacadorNaPosicaoI: true, golpeAntesDoApito: false, segundosAposApito: 8 }).situacao, 'VALIDO')
  const lento = avaliarExecucaoDoSaque({ sacadorNaPosicaoI: true, golpeAntesDoApito: false, segundosAposApito: 9 })
  assert.equal(lento.situacao, 'FALTA')
  assert.equal(lento.codigo, 'RG-SAQ-003')
  const cedo = avaliarExecucaoDoSaque({ sacadorNaPosicaoI: true, golpeAntesDoApito: true })
  assert.equal(cedo.situacao, 'REPETIR')
})

caso('RG-SAQ-003: o sacador precisa ser o da posição I', () => {
  const r = avaliarExecucaoDoSaque({ sacadorNaPosicaoI: false, golpeAntesDoApito: false, segundosAposApito: 2 })
  assert.equal(r.situacao, 'FALTA')
  assert.equal(r.codigo, 'RG-ROT-001')
})

/* ------------------------------ RG-POS-001/002/005 ------------------------------ */

// Índices 0..5 = posições I..VI; x da esquerda para a direita de frente para a rede; y = distância da rede.
const ORDENADA: PosicaoNaQuadra[] = [
  { x: 9, y: 7 }, // I
  { x: 9, y: 1 }, // II
  { x: 5, y: 1 }, // III
  { x: 1, y: 1 }, // IV
  { x: 1, y: 7 }, // V
  { x: 5, y: 7 }, // VI
]

caso('RG-POS-001: a equipe receptora na ordem de rotação não comete falta de posição', () => {
  assert.equal(validarPosicoesNoSaque({ equipe: 'B', saca: 'A', posicoes: ORDENADA }).ok, true)
})

caso('RG-POS-001: jogador de trás mais perto da rede que o da frente, ou laterais trocadas, é falta de posição', () => {
  const fundoAdiantado = ORDENADA.map((p, i) => (i === 5 ? { ...p, y: 0.5 } : p)) // VI na frente do III
  const r1 = validarPosicoesNoSaque({ equipe: 'B', saca: 'A', posicoes: fundoAdiantado })
  assert.equal(r1.ok === false && r1.codigo, 'RG-POS-001')
  const lateralTrocada = ORDENADA.map((p, i) => (i === 1 ? { ...p, x: 3 } : p)) // II à esquerda do III
  const r2 = validarPosicoesNoSaque({ equipe: 'B', saca: 'A', posicoes: lateralTrocada })
  assert.equal(r2.ok === false && r2.codigo, 'RG-POS-001')
  assert.equal(validarPosicoesNoSaque({ equipe: 'B', saca: 'A', posicoes: ORDENADA.slice(0, 5) }).ok, false)
})

caso('RG-POS-002: a equipe sacadora pode ocupar qualquer posição relativa', () => {
  const bagunca = ORDENADA.map((p, i) => ({ x: 10 - i, y: i }))
  assert.equal(validarPosicoesNoSaque({ equipe: 'A', saca: 'A', posicoes: bagunca }).ok, true)
})

caso('RG-POS-005: jogador em quadra por substituição ilegal com o jogo reiniciado conta como falta de posição com as consequências de RG-SUB-009', () => {
  const pontosDoSet = [
    { seq: 2, equipe: 'A' as Equipe },
    { seq: 3, equipe: 'A' as Equipe },
    { seq: 4, equipe: 'B' as Equipe },
  ]
  const r = faltaDePosicaoPorSubstituicaoIlegal({ equipeFaltosa: 'A', jogoReiniciado: true, momentoSeq: 3, pontosDoSet })
  assert.equal(r.codigo, 'RG-POS-005')
  assert.equal(r.consequencia.tipo, 'REVERSAO')
  if (r.consequencia.tipo === 'REVERSAO') assert.deepEqual(r.consequencia.reversao.cancelados, [3])
  const antes = faltaDePosicaoPorSubstituicaoIlegal({ equipeFaltosa: 'A', jogoReiniciado: false, momentoSeq: 3, pontosDoSet })
  assert.equal(antes.consequencia.tipo, 'ATRASO')
})

/* ------------------------------ RG-PTO-001/002 ------------------------------ */

caso('RG-PTO-001: cada rally concluído dá 1 ponto à equipe que o ganhou, tenha ela sacado ou não (rally point)', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  j.ponto('A') // quem sacou ganhou
  j.ponto('B') // quem recebia ganhou: ponto e saque
  const p = j.estado()
  assert.deepEqual(p.setAtual?.placar, { a: 1, b: 1 })
  assert.equal(p.saca, 'B')
})

caso('RG-PTO-002: faltas simultâneas de adversários são falta dupla: o rally se repete sem ponto', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  j.ponto('A')
  j.add('RALLY_REPETIDO', { motivo: 'FALTA_DUPLA' })
  const p = j.estado()
  assert.deepEqual(p.setAtual?.placar, { a: 1, b: 0 })
  assert.equal(p.saca, 'A')
  assert.equal(p.setAtual?.rallysRepetidos, 1)
  assert.deepEqual(p.inconsistencias, [])
  assert.deepEqual(decidirFaltasDoRally([{ equipe: 'A', instante: 10 }, { equipe: 'B', instante: 10 }]), { resultado: 'FALTA_DUPLA' })
})

caso('RG-PTO-002: de duas faltas sucessivas só a primeira conta', () => {
  const r = decidirFaltasDoRally([
    { equipe: 'B', instante: 12 },
    { equipe: 'A', instante: 11 },
  ])
  assert.equal(r.resultado, 'PONTO')
  if (r.resultado === 'PONTO') assert.equal(r.pontoParaEquipe, 'B') // A errou primeiro
  assert.equal(decidirFaltasDoRally([]).resultado, 'SEM_FALTA')
})

/* ------------------------------ RG-SAN-008 ------------------------------ */

caso('RG-SAN-008: o membro desqualificado não participa mais da partida e não recebe nova sanção', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  j.add('SANCAO', { equipe: 'A', membro: 'J:3', categoria: 'AGRESSAO', sancao: 'DESQUALIFICACAO', pontoParaAdversario: false })
  j.ponto('A', 25)
  j.iniciarSet(2, 'B')
  const p = j.estado()
  assert.deepEqual(p.inconsistencias, [])
  assert.ok(jogadoresImpedidos(p.estadoEquipes!.A).includes(3), 'continua impedido no set seguinte')
  const nova = avaliarSancao(p.estadoEquipes!.sancoes, { equipe: 'A', membro: 'J:3', categoria: 'MENOR', set: 2 })
  assert.equal(nova.ok, false)
  if (!nova.ok) assert.equal(nova.codigo, 'RG-SAN-008')
})

/* ------------------------------ RG-WO-003 ------------------------------ */

caso('RG-WO-003: o WO exige ao menos 6 jogadores da equipe presente', () => {
  assert.equal(validarPresencaDaVencedoraNoWO(6).ok, true)
  const r = validarPresencaDaVencedoraNoWO(5)
  assert.equal(r.ok === false && r.codigo, 'RG-WO-003')
})

caso('RG-WO-003: o Quadro de Resultados do WO lança P=alvo e V=1 para a presente e zeros no resto', () => {
  const wo = resolverWO(c5, { ausente: 'B' })
  const quadro = quadroResultadosWO(wo)
  assert.equal(quadro.length, 3)
  for (const linha of quadro) {
    assert.deepEqual(linha.pontos, { a: 25, b: 0 })
    assert.deepEqual(linha.vitorias, { a: 1, b: 0 })
    assert.equal(linha.lancadoComoWO, true)
    assert.deepEqual(linha.tempos, { a: 0, b: 0 })
    assert.deepEqual(linha.substituicoes, { a: 0, b: 0 })
    assert.equal(linha.duracaoMinutos, 0)
  }
})

caso('RG-WO-003: no WO depois de sets jogados, os sets jogados ficam como estão e só os restantes são lançados', () => {
  const wo = resolverWO(c5, { ausente: 'B', setsJogados: [{ a: 25, b: 20 }] })
  const quadro = quadroResultadosWO(wo)
  assert.equal(quadro[0]!.lancadoComoWO, false)
  assert.equal(quadro[0]!.tempos, null)
  assert.equal(quadro[1]!.lancadoComoWO, true)
})

/* ------------------------------ RG-FEC-001 / RG-FEC-005 ------------------------------ */

caso('RG-FEC-001: antes do jogo assinam técnicos e capitães, e os capitães assinam o sorteio', () => {
  const completo = {
    tecnico: { A: 'ASSINOU', B: 'ASSINOU' },
    capitao: { A: true, B: true },
    sorteio: { A: true, B: true },
  } as const
  assert.equal(validarAssinaturasDeAbertura(completo).ok, true)
  const semTecnico = validarAssinaturasDeAbertura({ ...completo, tecnico: { A: 'ASSINOU', B: 'SEM_TECNICO' } })
  assert.equal(semTecnico.ok, true, 'equipe sem técnico: o capitão responde')
  assert.equal(validarAssinaturasDeAbertura({ ...completo, tecnico: { A: 'PENDENTE', B: 'ASSINOU' } }).ok, false)
  assert.equal(validarAssinaturasDeAbertura({ ...completo, capitao: { A: true, B: false } }).ok, false)
  const semSorteio = validarAssinaturasDeAbertura({ ...completo, sorteio: { A: true, B: false } })
  assert.equal(semSorteio.ok === false && semSorteio.codigo, 'RG-FEC-001')
})

caso('RG-FEC-005: com a súmula oficializada a equipe não altera o resultado; o organizador corrige com motivo', () => {
  assert.equal(validarAlteracaoDeResultado({ oficializada: false, autor: 'EQUIPE' }).ok, true)
  const equipe = validarAlteracaoDeResultado({ oficializada: true, autor: 'EQUIPE', motivo: 'erro' })
  assert.equal(equipe.ok === false && equipe.codigo, 'RG-FEC-005')
  const semMotivo = validarAlteracaoDeResultado({ oficializada: true, autor: 'ORGANIZADOR', motivo: '  ' })
  assert.equal(semMotivo.ok === false && semMotivo.codigo, 'RG-FEC-005')
  assert.equal(validarAlteracaoDeResultado({ oficializada: true, autor: 'ORGANIZADOR', motivo: 'Placar digitado errado.' }).ok, true)
})

encerrar('regras-volei-complementos')
