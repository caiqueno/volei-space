import assert from 'node:assert/strict'
import { decidirFalhaAoVivo, TEXTO_SEM_CONEXAO } from '../src/lib/ao-vivo-conexao'

assert.deepEqual(decidirFalhaAoVivo(true), { mostrarErroCompleto: false, mostrarAvisoSemConexao: true })
assert.deepEqual(decidirFalhaAoVivo(false), { mostrarErroCompleto: true, mostrarAvisoSemConexao: false })
assert.equal(TEXTO_SEM_CONEXAO, 'Sem conexão. Tentando de novo')
console.log('ao-vivo-conexao ok')
