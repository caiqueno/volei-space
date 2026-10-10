import assert from 'node:assert/strict'
import { transicaoAoEncerrarSet } from '../src/lib/troca-set'

const aposSet1 = transicaoAoEncerrarSet({
  setAtual: 1,
  setsPorPartida: 3,
  setsParaVencer: 2,
  setsA: 1,
  setsB: 0,
  ladosInvertidos: false,
  saqueInicialDoSet: 'teamA',
})
assert.equal(aposSet1.segue, true)
assert.equal(aposSet1.proximoSet, 2)
assert.equal(aposSet1.ladosInvertidos, true)
assert.equal(aposSet1.modoSaque, 'alternancia')
assert.equal(aposSet1.saque, 'teamB')

const aposSet2 = transicaoAoEncerrarSet({
  setAtual: 2,
  setsPorPartida: 3,
  setsParaVencer: 2,
  setsA: 1,
  setsB: 1,
  ladosInvertidos: true,
  saqueInicialDoSet: 'teamB',
})
assert.equal(aposSet2.proximoSet, 3)
assert.equal(aposSet2.ladosInvertidos, false)
assert.equal(aposSet2.modoSaque, 'sorteio')
assert.equal(aposSet2.saque, null)

const aposSet2DeCinco = transicaoAoEncerrarSet({
  setAtual: 2,
  setsPorPartida: 5,
  setsParaVencer: 3,
  setsA: 1,
  setsB: 1,
  ladosInvertidos: true,
  saqueInicialDoSet: 'teamB',
})
assert.equal(aposSet2DeCinco.proximoSet, 3)
assert.equal(aposSet2DeCinco.modoSaque, 'alternancia')
assert.equal(aposSet2DeCinco.saque, 'teamA')

const fimEmDoisSets = transicaoAoEncerrarSet({
  setAtual: 2,
  setsPorPartida: 3,
  setsParaVencer: 2,
  setsA: 2,
  setsB: 0,
  ladosInvertidos: true,
  saqueInicialDoSet: 'teamB',
})
assert.equal(fimEmDoisSets.segue, false)
assert.equal(fimEmDoisSets.proximoSet, null)
assert.equal(fimEmDoisSets.ladosInvertidos, true)
assert.equal(fimEmDoisSets.saque, null)

const tieBreak = transicaoAoEncerrarSet({
  setAtual: 4,
  setsPorPartida: 5,
  setsParaVencer: 3,
  setsA: 2,
  setsB: 2,
  ladosInvertidos: false,
  saqueInicialDoSet: 'teamA',
})
assert.equal(tieBreak.proximoSet, 5)
assert.equal(tieBreak.ladosInvertidos, true)
assert.equal(tieBreak.modoSaque, 'sorteio')
assert.equal(tieBreak.saque, null)

console.log('Troca de set: o lado inverte quando o jogo segue; o último set da fase fica no sorteio.')
