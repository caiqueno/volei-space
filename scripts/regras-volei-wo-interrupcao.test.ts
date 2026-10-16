import {
  avaliarToleranciaWO,
  CONFIG_FIVB_MELHOR_DE_5,
  configMelhorDe3,
  criarEstadoEquipe,
  decidirInterrupcao,
  equipePodeJogarProximoSet,
  observacaoInterrupcao,
  resolverEquipeIncompleta,
  resolverWO,
  validarToleranciaDeWO,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5

caso('RG-WO-001: equipe ausente antes do jogo = 3x0 com 25x0 em cada set', () => {
  const r = resolverWO(c5, { ausente: 'B' })
  assert.equal(r.tipo, 'WO_SIMPLES')
  assert.equal(r.vencedor, 'A')
  assert.deepEqual(r.placarPartida, { setsA: 3, setsB: 0 })
  assert.deepEqual(r.parciaisRegistrados, [{ a: 25, b: 0 }, { a: 25, b: 0 }, { a: 25, b: 0 }])
  assert.equal(r.assinam, 'TODOS')
  const inverso = resolverWO(c5, { ausente: 'A' })
  assert.equal(inverso.vencedor, 'B')
  assert.deepEqual(inverso.placarPartida, { setsA: 0, setsB: 3 })
  assert.deepEqual(inverso.parciaisRegistrados[0], { a: 0, b: 25 })
})

caso('RG-WO-001 / CJ-06(e): recusa no meio do jogo mantém os sets jogados e lança 25x0 no restante', () => {
  const jogados = [{ a: 25, b: 20 }, { a: 20, b: 25 }, { a: 25, b: 22 }, { a: 22, b: 25 }]
  const r = resolverWO(c5, { ausente: 'B', setsJogados: jogados })
  assert.equal(r.vencedor, 'A')
  assert.equal(r.setsLancadosComoWO, 1)
  assert.deepEqual(r.parciaisRegistrados.slice(0, 4), jogados)
  assert.deepEqual(r.parciaisRegistrados[4], { a: 15, b: 0 }, 'o 5º set usa o alvo do set decisivo, não 25 fixo')
  assert.deepEqual(r.placarPartida, { setsA: 3, setsB: 0 })
  assert.deepEqual(r.setsRegistrados, { a: 2, b: 2 }, 'os sets jogados ficam só como registro')
})

caso('RG-WO-001: em melhor de 3 a vitória por WO é por 2 sets', () => {
  const r = resolverWO(configMelhorDe3(), { ausente: 'A' })
  assert.deepEqual(r.placarPartida, { setsA: 0, setsB: 2 })
  assert.equal(r.parciaisRegistrados.length, 2)
})

caso('RG-WO-001: o parcial dos sets lançados como WO segue o alvo configurado da categoria', () => {
  const r = resolverWO(configMelhorDe3({ alvoSet: 21, alvoSetDecisivo: 15 }), { ausente: 'B', setsJogados: [{ a: 18, b: 21 }] })
  assert.deepEqual(r.parciaisRegistrados, [{ a: 18, b: 21 }, { a: 21, b: 0 }, { a: 15, b: 0 }])
})

caso('RG-WO-001: o parcial dos sets lançados como WO segue o alvo configurado da categoria', () => {
  const r = resolverWO(configMelhorDe3({ alvoSet: 21, alvoSetDecisivo: 15 }), { ausente: 'B', setsJogados: [{ a: 18, b: 21 }] })
  assert.deepEqual(r.parciaisRegistrados, [{ a: 18, b: 21 }, { a: 21, b: 0 }, { a: 15, b: 0 }])
})

caso('RG-WO-002: WO por não comparecimento só após a tolerância do regulamento', () => {
  const cedo = validarToleranciaDeWO(10, 30)
  assert.equal(cedo.ok, false)
  if (!cedo.ok) assert.equal(cedo.codigo, 'RG-WO-002')
  assert.equal(validarToleranciaDeWO(30, 30).ok, true)
  assert.equal(validarToleranciaDeWO(14, 15).ok, false)
})

caso('RG-WO-004: WO duplo não tem vencedor e só a arbitragem assina', () => {
  const r = resolverWO(c5, { ausente: 'AMBAS' })
  assert.equal(r.tipo, 'WO_DUPLO')
  assert.equal(r.vencedor, null)
  assert.equal(r.assinam, 'APENAS_ARBITRAGEM')
  assert.deepEqual(r.parciaisRegistrados, [])
  assert.deepEqual(r.placarPartida, { setsA: 0, setsB: 0 })
})

caso('RG-WO-005: equipe incompleta no set perde, mantém seus pontos e o adversário recebe o necessário', () => {
  const r = resolverEquipeIncompleta(c5, {
    equipeIncompleta: 'B',
    escopo: 'SET',
    numeroSet: 1,
    placarAtual: { a: 12, b: 8 },
  })
  assert.deepEqual(r.placarSetAjustado, { a: 25, b: 8 })
  assert.equal(r.vencedorDoSet, 'A')
  assert.equal(r.vencedorDaPartida, null)
})

caso('RG-WO-005: incompleta que estava na frente ainda perde o set e mantém seus pontos', () => {
  const r = resolverEquipeIncompleta(c5, {
    equipeIncompleta: 'A',
    escopo: 'SET',
    numeroSet: 1,
    placarAtual: { a: 24, b: 20 },
  })
  assert.deepEqual(r.placarSetAjustado, { a: 24, b: 26 })
  assert.equal(r.vencedorDoSet, 'B')
})

caso('RG-SAN-012: incompleta para o jogo perde a partida mantendo pontos e sets', () => {
  const r = resolverEquipeIncompleta(c5, {
    equipeIncompleta: 'A',
    escopo: 'JOGO',
    numeroSet: 2,
    placarAtual: { a: 10, b: 14 },
    setsJogados: [{ a: 25, b: 20 }],
  })
  assert.equal(r.vencedorDaPartida, 'B')
  assert.deepEqual(r.placarSetAjustado, { a: 10, b: 25 })
  // B venceu 0 sets; ganha o 2º set (ajustado) e mais 2 sets lançados: partida 3x1 para B, A mantém o set 1
  assert.equal(r.setsAdicionais.length, 2)
  assert.deepEqual(r.setsAdicionais[0], { a: 0, b: 25 })
})

caso('RG-WO-005: sem 6 jogadores aptos a equipe fica incompleta para o jogo', () => {
  const sete = criarEstadoEquipe({ elenco: [1, 2, 3, 4, 5, 6, 7], formacaoInicial: [1, 2, 3, 4, 5, 6] })
  assert.equal(equipePodeJogarProximoSet(sete).ok, true)
  const cinco = { ...sete, expulsosNoSet: [6], desqualificados: [7] }
  const r = equipePodeJogarProximoSet(cinco)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-WO-005')
})

caso('RG-INT-003 / CJ-06(a): mesma quadra, set continua com o placar; observação padronizada', () => {
  const d = decidirInterrupcao({ minutosTotaisDeParalisacao: 20, voltaNaMesmaQuadra: true })
  assert.equal(d.acao, 'CONTINUAR_SET')
  assert.equal(d.codigo, 'RG-INT-003')
  assert.equal(
    observacaoInterrupcao({ numeroSet: 2, pontosA: 2, pontosB: 5, minutos: 20, motivo: 'falta de energia' }),
    'JOGO INTERROMPIDO NO 2º SET, PLACAR 2X5, POR 20 MINUTOS, POR MOTIVO DE FALTA DE ENERGIA',
  )
})

caso('RG-INT-004 / CJ-06(b): outra quadra anula o set e rejoga do 0x0', () => {
  const d = decidirInterrupcao({ minutosTotaisDeParalisacao: 45, voltaNaMesmaQuadra: false })
  assert.equal(d.acao, 'ANULAR_SET_E_REJOGAR')
  assert.equal(d.codigo, 'RG-INT-004')
})

caso('RG-INT-005 / CJ-06(c): paralisações acima de 4 horas repetem a partida inteira', () => {
  assert.equal(decidirInterrupcao({ minutosTotaisDeParalisacao: 241, voltaNaMesmaQuadra: true }).acao, 'REPETIR_PARTIDA')
  assert.equal(decidirInterrupcao({ minutosTotaisDeParalisacao: 240, voltaNaMesmaQuadra: true }).acao, 'CONTINUAR_SET')
})

/* ---------------- RG-WO-002: tolerância com horários (parâmetro do regulamento) ---------------- */

const previsto = '2026-10-16T19:00:00.000Z'
const aos = (min: number) => new Date(Date.parse(previsto) + min * 60000).toISOString()

caso('RG-WO-002: dentro da tolerância configurada o WO por atraso é recusado', () => {
  const cfg = configMelhorDe3({ toleranciaWOMinutos: 20 })
  const r = avaliarToleranciaWO(cfg, { horarioPrevisto: previsto, agora: aos(10) })
  assert.equal(r.resultado.ok, false)
  assert.equal(r.minutosDeAtraso, 10)
  assert.equal(r.toleranciaMinutos, 20)
  if (!r.resultado.ok) assert.equal(r.resultado.codigo, 'RG-WO-002')
})

caso('RG-WO-002: passada a tolerância configurada o WO pode ser declarado (valor vem da config, não do código)', () => {
  const cfg = configMelhorDe3({ toleranciaWOMinutos: 20 })
  assert.equal(avaliarToleranciaWO(cfg, { horarioPrevisto: previsto, agora: aos(20) }).resultado.ok, true)
  assert.equal(avaliarToleranciaWO(cfg, { horarioPrevisto: previsto, agora: aos(45) }).resultado.ok, true)
  const outra = configMelhorDe3({ toleranciaWOMinutos: 30 })
  assert.equal(avaliarToleranciaWO(outra, { horarioPrevisto: previsto, agora: aos(25) }).resultado.ok, false)
})

caso('RG-WO-002: o WO duplo usa a própria tolerância quando configurada', () => {
  const cfg = configMelhorDe3({ toleranciaWOMinutos: 30, toleranciaWODuploMinutos: 15 })
  assert.equal(avaliarToleranciaWO(cfg, { horarioPrevisto: previsto, agora: aos(16), duplo: true }).resultado.ok, true)
  assert.equal(avaliarToleranciaWO(cfg, { horarioPrevisto: previsto, agora: aos(16) }).resultado.ok, false)
  const semDuplo = configMelhorDe3({ toleranciaWOMinutos: 30 })
  assert.equal(avaliarToleranciaWO(semDuplo, { horarioPrevisto: previsto, agora: aos(16), duplo: true }).resultado.ok, false)
})

caso('RG-WO-002: sem tolerância configurada ou com horário inválido o WO por atraso não é declarado', () => {
  const sem = avaliarToleranciaWO(configMelhorDe3(), { horarioPrevisto: previsto, agora: aos(120) })
  assert.equal(sem.resultado.ok, false)
  assert.equal(sem.toleranciaMinutos, null)
  const invalido = avaliarToleranciaWO(configMelhorDe3({ toleranciaWOMinutos: 15 }), { horarioPrevisto: 'x', agora: aos(120) })
  assert.equal(invalido.resultado.ok, false)
})

caso('RG-WO-002: antes da hora prevista o atraso é zero', () => {
  const r = avaliarToleranciaWO(configMelhorDe3({ toleranciaWOMinutos: 0 }), { horarioPrevisto: previsto, agora: aos(-5) })
  assert.equal(r.minutosDeAtraso, 0)
})

encerrar('regras-volei-wo-interrupcao')
