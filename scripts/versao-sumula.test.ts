import assert from 'node:assert/strict'
import { deveRecusarAndamento, lerVersaoRegistro, maiorVersaoRegistro, marcarVersaoRegistro, versaoEhAntiga } from '../src/lib/versao-sumula'

const registro = marcarVersaoRegistro('Registro de placar pelo árbitro 1 em 2026-10-10T11:46:55.321Z: 1:1-0', 6)

assert.equal(lerVersaoRegistro(registro), 6)
assert.equal(lerVersaoRegistro('Registro de placar pelo árbitro 1 em 2026-10-10T11:46:49.977Z: 1:2-0'), null)
assert.equal(maiorVersaoRegistro([
  'Registro de placar pelo árbitro 1 em 2026-10-10T11:46:55.321Z: 1:1-0 [[V:4]]',
  'Registro de placar pelo árbitro 1 em 2026-10-10T11:46:57.274Z: 1:2-0',
  'Registro de presença',
]), 4)
assert.equal(versaoEhAntiga(4, null), false)
assert.equal(versaoEhAntiga(4, 4), false)
assert.equal(versaoEhAntiga(5, 6), true)

assert.equal(deveRecusarAndamento({
  versaoCliente: 5,
  versaoGravada: 6,
  reservaId: 101,
  reservaMaisNova: 101,
}), true)
assert.equal(deveRecusarAndamento({
  versaoCliente: 6,
  versaoGravada: 6,
  reservaId: 100,
  reservaMaisNova: 101,
}), true)
assert.equal(deveRecusarAndamento({
  versaoCliente: null,
  versaoGravada: 6,
  reservaId: 100,
  reservaMaisNova: 101,
}), true)
assert.equal(deveRecusarAndamento({
  versaoCliente: 7,
  versaoGravada: 6,
  reservaId: 102,
  reservaMaisNova: 102,
}), false)
assert.equal(deveRecusarAndamento({
  versaoCliente: null,
  versaoGravada: null,
  reservaId: 102,
  reservaMaisNova: 102,
}), false)

console.log('versao-sumula ok')
