import assert from 'node:assert/strict'
import { calcularClassificacao, FAIXAS_PADRAO } from '../src/lib/classificacao'
import { placarDoWo } from '../src/lib/wo'

const times = [
  { equipeId: 1, categoriaCampeonatoId: 'cat', categoria: 'MISTO' },
  { equipeId: 2, categoriaCampeonatoId: 'cat', categoria: 'MISTO' },
]

const semPlacar = calcularClassificacao({
  times,
  partidas: [{
    equipeAId: 1,
    equipeBId: 2,
    fase: 'GRUPOS',
    status: 'WO',
    categoriaCampeonatoId: 'cat',
    setsPorA: 0,
    setsPorB: 0,
    vencedorId: 1,
  }],
})
assert.equal(semPlacar.find((linha) => linha.equipeId === 1)?.pontos, FAIXAS_PADRAO.pontosVencedorMargem2)
assert.equal(semPlacar.find((linha) => linha.equipeId === 1)?.setsPro, 0)
assert.equal(semPlacar.find((linha) => linha.equipeId === 2)?.punicoes, 0)
assert.equal(semPlacar.find((linha) => linha.equipeId === 2)?.pontos, FAIXAS_PADRAO.pontosPerdedorMargem2)

const comPlacar = calcularClassificacao({
  times,
  partidas: [{
    equipeAId: 1,
    equipeBId: 2,
    fase: 'GRUPOS',
    status: 'WO',
    categoriaCampeonatoId: 'cat',
    setsPorA: 0,
    setsPorB: 0,
    vencedorId: 2,
  }],
  regras: {
    cat: {
      wo: { setsVencedor: 2, setsPerdedor: 0, pontosSetVencedor: 25, pontosSetPerdedor: 0, punicaoPontos: 1 },
    },
  },
})
const vencedor = comPlacar.find((linha) => linha.equipeId === 2)
const perdedor = comPlacar.find((linha) => linha.equipeId === 1)
assert.equal(vencedor?.setsPro, 2)
assert.equal(vencedor?.pontosPro, 50)
assert.equal(vencedor?.vitorias, 1)
assert.equal(vencedor?.pontos, FAIXAS_PADRAO.pontosVencedorMargem2)
assert.equal(perdedor?.setsContra, 2)
assert.equal(perdedor?.punicoes, 1)
assert.equal(perdedor?.pontos, FAIXAS_PADRAO.pontosPerdedorMargem2 - 1)
assert.deepEqual(placarDoWo({ setsVencedor: null, punicaoPontos: 2 }, false), {
  setsA: 0,
  setsB: 0,
  pontosA: 0,
  pontosB: 0,
  punicaoNoPerdedor: 2,
})

console.log('W.O. configurável passou: padrão atual, placar 2x0 e punição.')
