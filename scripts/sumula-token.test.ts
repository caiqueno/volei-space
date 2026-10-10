import assert from 'node:assert/strict'
import { gerarSumulaToken, sumulaTokenLegadoPrevisivel } from '../src/lib/sumula-token'

const tokens = Array.from({ length: 30 }, () => gerarSumulaToken())
assert.equal(new Set(tokens).size, 30)
for (const token of tokens) {
  assert.equal(sumulaTokenLegadoPrevisivel(token), false)
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
}

assert.equal(sumulaTokenLegadoPrevisivel('luv-12-g1-r1-3-4'), true)
assert.equal(sumulaTokenLegadoPrevisivel('luv-12-semifinal-1-3-4'), true)
assert.equal(sumulaTokenLegadoPrevisivel('luv-12-1-3-4'), true)
assert.equal(sumulaTokenLegadoPrevisivel('token-demo-1-luva2026'), false)

console.log('sumula-token: ok')
