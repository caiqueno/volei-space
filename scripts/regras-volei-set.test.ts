import {
  alvoDoSet,
  CONFIG_FIVB_MELHOR_DE_5,
  configMelhorDe3,
  contarSets,
  deveTrocarDeLado,
  ehSetDecisivo,
  partidaEncerrada,
  saqueInicialDoSet,
  setEncerrado,
  setsParaVencer,
  validarPedidoDeTempo,
  validarPlacarFinalSet,
  validarSequenciaDePartida,
  vencedorDoSet,
} from '../src/lib/regras-volei'
import { LIMITE_OFICIAL_TEMPOS, PERFIL_AMADOR, PERFIL_FIVB_CBV } from '../src/lib/regras-volei/config'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5

caso('RG-TMP-001: o padrão oficial é de 2 tempos por set, em todos os perfis', () => {
  assert.equal(LIMITE_OFICIAL_TEMPOS, 2)
  assert.equal(PERFIL_FIVB_CBV.temposPorSet, 2)
  assert.equal(PERFIL_AMADOR.temposPorSet, 2)
})

caso('RG-SET-001: 25 pontos com 2 de vantagem encerra o set', () => {
  assert.equal(setEncerrado({ a: 25, b: 23 }, 25), true)
  assert.equal(setEncerrado({ a: 25, b: 20 }, 25), true)
  assert.equal(setEncerrado({ a: 24, b: 10 }, 25), false)
  assert.equal(vencedorDoSet({ a: 21, b: 25 }, 25), 'B')
})

caso('RG-SET-002: 24x24 e 25x24 continuam; 26x24 e 30x28 encerram (sem teto)', () => {
  assert.equal(setEncerrado({ a: 24, b: 24 }, 25), false)
  assert.equal(setEncerrado({ a: 25, b: 24 }, 25), false)
  assert.equal(setEncerrado({ a: 26, b: 24 }, 25), true)
  assert.equal(setEncerrado({ a: 30, b: 28 }, 25), true)
  assert.equal(setEncerrado({ a: 30, b: 29 }, 25), false)
  assert.equal(setEncerrado({ a: 31, b: 29 }, 25), true)
})

caso('RG-SET-002: alvos configuráveis 15, 21 e 25 (D10)', () => {
  assert.equal(setEncerrado({ a: 21, b: 19 }, 21), true)
  assert.equal(setEncerrado({ a: 21, b: 20 }, 21), false)
  assert.equal(setEncerrado({ a: 22, b: 20 }, 21), true)
  assert.equal(setEncerrado({ a: 15, b: 14 }, 15), false)
  assert.equal(setEncerrado({ a: 16, b: 14 }, 15), true)
  assert.equal(setEncerrado({ a: 17, b: 15 }, 15), true)
})

caso('RG-SET-002: validação do placar final explica o bloqueio com código', () => {
  const emAndamento = validarPlacarFinalSet({ a: 20, b: 10 }, 25)
  assert.equal(emAndamento.ok, false)
  if (!emAndamento.ok) assert.equal(emAndamento.codigo, 'RG-SET-001')
  const semMargem = validarPlacarFinalSet({ a: 25, b: 24 }, 25)
  assert.equal(semMargem.ok, false)
  if (!semMargem.ok) {
    assert.equal(semMargem.codigo, 'RG-SET-002')
    assert.match(semMargem.mensagem, /vantagem/)
  }
  const impossivel = validarPlacarFinalSet({ a: 27, b: 24 }, 25)
  assert.equal(impossivel.ok, false)
  assert.equal(validarPlacarFinalSet({ a: 26, b: 24 }, 25).ok, true)
  assert.equal(validarPlacarFinalSet({ a: 25, b: 0 }, 25).ok, true)
})

caso('RG-SET-003: set decisivo aos 15 com 2 de vantagem quando 2x2', () => {
  assert.equal(setsParaVencer(5), 3)
  assert.equal(ehSetDecisivo(c5, 2, 2), true)
  assert.equal(ehSetDecisivo(c5, 2, 1), false)
  assert.equal(alvoDoSet(c5, 4), 25)
  assert.equal(alvoDoSet(c5, 5), 15)
  assert.equal(setEncerrado({ a: 15, b: 14 }, alvoDoSet(c5, 5)), false)
  assert.equal(setEncerrado({ a: 17, b: 15 }, alvoDoSet(c5, 5)), true)
})

caso('RG-SET-004: partida acaba na maioria dos sets (melhor de 5 e de 3)', () => {
  assert.equal(partidaEncerrada(3, 0, c5), true)
  assert.equal(partidaEncerrada(2, 2, c5), false)
  assert.equal(partidaEncerrada(3, 2, c5), true)
  const c3 = configMelhorDe3()
  assert.equal(partidaEncerrada(2, 0, c3), true)
  assert.equal(partidaEncerrada(1, 1, c3), false)
})

caso('RG-SET-004: 3º set obrigatório (D2) mantém 2x0 aberto, mas 2x1 e 3x0 fecham', () => {
  const c3 = configMelhorDe3({ terceiroSetObrigatorio: true })
  assert.equal(partidaEncerrada(2, 0, c3), false)
  assert.equal(partidaEncerrada(2, 1, c3), true)
  assert.equal(partidaEncerrada(3, 0, c3), true)
  // 2x0 com 3º obrigatório não é set decisivo (sem novo sorteio nem troca aos 8) [M]
  assert.equal(ehSetDecisivo(c3, 2, 0), false)
  assert.equal(alvoDoSet(c3, 3), c3.alvoSetDecisivo)
})

caso('RG-SET-004: sequência de sets não aceita 6º set nem partida incompleta', () => {
  const ok = [
    { placar: { a: 25, b: 20 } },
    { placar: { a: 25, b: 22 } },
    { placar: { a: 25, b: 18 } },
  ]
  assert.equal(validarSequenciaDePartida(ok, c5).ok, true)
  const sexto = validarSequenciaDePartida([...ok, { placar: { a: 25, b: 0 } }], c5)
  assert.equal(sexto.ok, false)
  if (!sexto.ok) assert.equal(sexto.codigo, 'RG-SET-004')
  const incompleta = validarSequenciaDePartida(ok.slice(0, 2), c5)
  assert.equal(incompleta.ok, false)
  const cincoSets = [
    { placar: { a: 25, b: 20 } },
    { placar: { a: 20, b: 25 } },
    { placar: { a: 25, b: 20 } },
    { placar: { a: 20, b: 25 } },
    { placar: { a: 17, b: 15 } },
  ]
  assert.equal(validarSequenciaDePartida(cincoSets, c5).ok, true)
  // 5º set com placar de 25 pontos? 25x20 também fecha, mas 15x13 é incompleto
  const quinto = validarSequenciaDePartida([...cincoSets.slice(0, 4), { placar: { a: 15, b: 14 } }], c5)
  assert.equal(quinto.ok, false)
  assert.deepEqual(contarSets(cincoSets, c5), { a: 3, b: 2 })
})

caso('RG-SET-006: troca de lado quando a líder atinge 8 no set decisivo', () => {
  const base = { decisivo: true, jaTrocou: false }
  assert.equal(deveTrocarDeLado(c5, { ...base, placar: { a: 7, b: 6 } }), false)
  assert.equal(deveTrocarDeLado(c5, { ...base, placar: { a: 8, b: 6 } }), true)
  assert.equal(deveTrocarDeLado(c5, { ...base, placar: { a: 3, b: 8 } }), true)
  assert.equal(deveTrocarDeLado(c5, { ...base, placar: { a: 9, b: 6 }, jaTrocou: true }), false)
  assert.equal(deveTrocarDeLado(c5, { decisivo: false, jaTrocou: false, placar: { a: 20, b: 18 } }), false)
})

caso('RG-FOR-003: sets 2 a 4 começam sacando quem NÃO sacou primeiro no set anterior', () => {
  assert.equal(saqueInicialDoSet({ decisivo: false, sacouPrimeiroNoSetAnterior: 'A' }), 'B')
  assert.equal(saqueInicialDoSet({ decisivo: false, sacouPrimeiroNoSetAnterior: 'B' }), 'A')
})

caso('RG-FOR-002: set decisivo exige novo sorteio', () => {
  assert.equal(saqueInicialDoSet({ decisivo: true, sacouPrimeiroNoSetAnterior: 'A' }), 'SORTEIO')
})

caso('RG-TMP-001: 2 tempos por set; o 3º pedido é indevido', () => {
  const base = { limite: 2, bolaForaDeJogo: true, antesDoApito: true }
  assert.equal(validarPedidoDeTempo({ ...base, temposUsados: 1 }).ok, true)
  const terceiro = validarPedidoDeTempo({ ...base, temposUsados: 2 })
  assert.equal(terceiro.ok, false)
  if (!terceiro.ok) assert.equal(terceiro.codigo, 'RG-TMP-001')
})

caso('RG-TMP-002: tempo só com bola fora de jogo e antes do apito', () => {
  const r = validarPedidoDeTempo({ temposUsados: 0, limite: 2, bolaForaDeJogo: false, antesDoApito: true })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-TMP-002')
  assert.equal(validarPedidoDeTempo({ temposUsados: 0, limite: 2, bolaForaDeJogo: true, antesDoApito: false }).ok, false)
})

encerrar('regras-volei-set')
