import assert from 'node:assert/strict'
import { campeonatosDoElenco, escolherLigaDoElenco } from '../src/lib/elenco-painel'

const ligas = [
  { id: 65, nome: 'Copa' },
  { id: 2, nome: 'Outro', simulacao: false },
  { id: 9, nome: 'Treino', simulacao: true },
]

assert.deepEqual(campeonatosDoElenco(ligas).map((liga) => liga.id), [65, 2])
assert.equal(escolherLigaDoElenco(ligas, null), 65)
assert.equal(escolherLigaDoElenco(ligas, 2), 2)
assert.equal(escolherLigaDoElenco(ligas, 99), 65)
assert.equal(escolherLigaDoElenco(ligas, 9), 65)
assert.equal(escolherLigaDoElenco([], 65), 65)
assert.equal(escolherLigaDoElenco([], null), null)

console.log('elenco-painel ok')
