import assert from 'node:assert/strict'
import { setEstaEncerrado, type RegraSet } from '../src/lib/set-encerrado'

const regras: RegraSet = { setsPorPartida: 3, pontosPorSet: 25, tieBreakUltimoSet: true, pontosUltimoSet: 15, diferencaMinimaSet: 2 }

assert.equal(setEstaEncerrado({ numero: 1, pontosA: 10, pontosB: 8 }, regras), false)
assert.equal(setEstaEncerrado({ numero: 1, pontosA: 25, pontosB: 20 }, regras), true)
assert.equal(setEstaEncerrado({ numero: 1, pontosA: 25, pontosB: 24 }, regras), false)
assert.equal(setEstaEncerrado({ numero: 3, pontosA: 15, pontosB: 13 }, regras), true)
assert.equal(setEstaEncerrado({ numero: 3, pontosA: 14, pontosB: 12 }, regras), false)
assert.equal(setEstaEncerrado({ numero: 3, pontosA: 25, pontosB: 23 }, regras), true)

console.log('Set encerrado: o set aberto fica de fora e o set fechado, inclusive o tie-break, entra.')
