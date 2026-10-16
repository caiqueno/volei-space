import assert from 'node:assert/strict'
import { decidirFalhaAoVivo, esperaNovaTentativaMs, TEXTO_SEM_CONEXAO } from '../src/lib/ao-vivo-conexao'

assert.deepEqual(decidirFalhaAoVivo(true), { mostrarErroCompleto: false, mostrarAvisoSemConexao: true })
assert.deepEqual(decidirFalhaAoVivo(false), { mostrarErroCompleto: true, mostrarAvisoSemConexao: false })
assert.equal(esperaNovaTentativaMs(1), 3000)
assert.equal(esperaNovaTentativaMs(2), 6000)
assert.equal(esperaNovaTentativaMs(4), 24000)
assert.equal(esperaNovaTentativaMs(5), 30000)
assert.equal(esperaNovaTentativaMs(40), 30000)
assert.equal(esperaNovaTentativaMs(0), 3000)
assert.equal(TEXTO_SEM_CONEXAO, 'Sem conexão. Tentando de novo')
console.log('ao-vivo-conexao ok')
