import assert from 'node:assert/strict'
import { avisoComContador, textoContadorTroca } from '../src/lib/contador-troca'

assert.equal(textoContadorTroca(0, 8), 'Troca 1 de 8 neste set.')
assert.equal(textoContadorTroca(2, 8), 'Troca 3 de 8 neste set.')
assert.equal(textoContadorTroca(7, 8), 'Troca 8 de 8 neste set.')
assert.equal(textoContadorTroca(8, 8), '8 de 8 trocas usadas neste set.')
assert.equal(textoContadorTroca(3, 6), 'Troca 4 de 6 neste set.')
assert.equal(avisoComContador('Troca 1 de 8 neste set.', null), 'Troca 1 de 8 neste set.')
assert.equal(avisoComContador('Troca 1 de 8 neste set.', 'Nenhum reserva elegível neste set.'), 'Troca 1 de 8 neste set. Nenhum reserva elegível neste set.')
console.log('contador-troca ok')
