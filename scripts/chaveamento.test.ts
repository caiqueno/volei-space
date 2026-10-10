import assert from 'node:assert/strict'
import { jogosDaPrimeiraRodada, metodoChaveamentoInformado, montarConfrontosAutomaticos } from '../src/lib/chave-grupos'

const grupos = [
  { id: 1, ordem: 1, classificados: [10, 11] },
  { id: 2, ordem: 2, classificados: [20, 21] },
]
const rounds = [{ fase: 'SEMIFINAL', slots: 2 }, { fase: 'FINAL', slots: 1 }]

const cruzado = jogosDaPrimeiraRodada({ grupos })
assert.deepEqual(cruzado, [
  { rodada: 1, equipeAId: 10, equipeBId: 21 },
  { rodada: 2, equipeAId: 20, equipeBId: 11 },
])
assert.deepEqual(jogosDaPrimeiraRodada({ grupos, metodo: 'CRUZAMENTO_GRUPOS' }), cruzado)
assert.deepEqual(jogosDaPrimeiraRodada({ grupos, metodo: 'DESCONHECIDO' }), cruzado)
assert.deepEqual(jogosDaPrimeiraRodada({ grupos, metodo: 'MANUAL' }), [])

assert.deepEqual(jogosDaPrimeiraRodada({ grupos, metodo: 'RANKING_GERAL', ranking: [10, 20, 11, 21] }), [
  { rodada: 1, equipeAId: 10, equipeBId: 21 },
  { rodada: 2, equipeAId: 20, equipeBId: 11 },
])
assert.deepEqual(jogosDaPrimeiraRodada({ grupos, metodo: 'SORTEIO', embaralhar: (ids) => [...ids].reverse() }), [
  { rodada: 1, equipeAId: 21, equipeBId: 20 },
  { rodada: 2, equipeAId: 11, equipeBId: 10 },
])

const manual = montarConfrontosAutomaticos({
  grupos,
  faseInicial: 'SEMIFINAL',
  rounds,
  disputaTerceiro: false,
  existentes: [],
  partidas: [],
  metodo: 'MANUAL',
})
assert.deepEqual(manual, [])

const finalManual = montarConfrontosAutomaticos({
  grupos: [],
  faseInicial: 'SEMIFINAL',
  rounds,
  disputaTerceiro: false,
  existentes: [
    { fase: 'SEMIFINAL', rodada: 1 },
    { fase: 'SEMIFINAL', rodada: 2 },
  ],
  partidas: [
    { fase: 'SEMIFINAL', rodada: 1, status: 'ENCERRADA', equipeAId: 10, equipeBId: 21, setsPorA: 2, setsPorB: 0, vencedorId: 10 },
    { fase: 'SEMIFINAL', rodada: 2, status: 'ENCERRADA', equipeAId: 20, equipeBId: 11, setsPorA: 0, setsPorB: 2, vencedorId: 11 },
  ],
  metodo: 'MANUAL',
})
assert.deepEqual(finalManual, [{ fase: 'FINAL', rodada: 1, equipeAId: 10, equipeBId: 11 }])

assert.equal(metodoChaveamentoInformado('SORTEIO'), 'SORTEIO')
assert.equal(metodoChaveamentoInformado(null), undefined)
assert.equal(metodoChaveamentoInformado('LIVRE'), undefined)

console.log('Chaveamento passou: cruzamento, ranking, sorteio e manual.')
