import assert from 'node:assert/strict'

process.env.LGPD_CHAVE_CIFRA = Buffer.alloc(32, 9).toString('base64')
delete process.env.LGPD_PEPPER_HASH

import {
  cpfValido,
  hashCpf,
  hashDocumento,
  mascararCifrado,
  mascararCpf,
  mascararDocumentoNumero,
  mascararTelefone,
  normalizarDocumentoNumero,
  normalizarTelefone,
} from '../src/lib/lgpd/documentos'
import { cifrarContato } from '../src/lib/lgpd/cifra'

// CPF: dígitos verificadores, pontuação aceita, sequência repetida recusada.
assert.equal(cpfValido('529.982.247-25'), true)
assert.equal(cpfValido('52998224725'), true)
assert.equal(cpfValido('111.444.777-35'), true)
assert.equal(cpfValido('529.982.247-24'), false, 'dígito verificador errado')
assert.equal(cpfValido('111.111.111-11'), false, 'sequência repetida')
assert.equal(cpfValido('123'), false)
assert.equal(cpfValido(''), false)

// Máscaras: nunca o valor inteiro.
assert.equal(mascararCpf('529.982.247-25'), '***.***.***-25')
assert.equal(mascararCpf('abc'), null)
assert.equal(mascararTelefone('11987655678'), '(11) *****-5678')
assert.equal(mascararTelefone('1133445678'), '(11) ****-5678')
assert.equal(mascararDocumentoNumero('MG1234567'), '*******67')
assert.ok(!mascararCpf('52998224725')!.includes('5299'))

// Telefone: normaliza +55, bloqueia número impossível.
assert.equal(normalizarTelefone('+55 (11) 98765-5678'), '11987655678')
assert.equal(normalizarTelefone('(11) 3344-5678'), '1133445678')
assert.equal(normalizarTelefone('(11) 88765-5678'), null, 'celular sem 9')
assert.equal(normalizarTelefone('12345'), null)
assert.equal(normalizarTelefone('(05) 98765-5678'), null, 'DDD inválido')

assert.equal(normalizarDocumentoNumero('mg-12.345.678'), 'MG12345678')
assert.equal(normalizarDocumentoNumero('1'), null)

// Hash: determinístico, com sal, não contém o CPF, e muda com o tipo do documento.
const h1 = hashCpf('529.982.247-25')
assert.equal(h1, hashCpf('52998224725'))
assert.match(h1, /^[0-9a-f]{64}$/)
assert.ok(!h1.includes('52998224725'))
assert.notEqual(h1, hashCpf('11144477735'))
assert.notEqual(hashDocumento('RG', 'MG123'), hashDocumento('CNH', 'MG123'))
process.env.LGPD_PEPPER_HASH = 'outro-sal-do-servidor-com-bastante-tamanho'
assert.notEqual(hashCpf('52998224725'), h1, 'sal diferente = hash diferente')
delete process.env.LGPD_PEPPER_HASH

// Sem nenhum sal, falha fechado (503), nunca grava hash sem sal.
const chave = process.env.LGPD_CHAVE_CIFRA
delete process.env.LGPD_CHAVE_CIFRA
assert.throws(() => hashCpf('52998224725'), (erro: any) => erro.status === 503)
process.env.LGPD_CHAVE_CIFRA = chave

// Máscara a partir do valor cifrado: o claro nunca sai; chave errada devolve null em vez de derrubar.
const cifrado = cifrarContato('52998224725')
assert.ok(!cifrado.includes('52998224725'))
assert.equal(mascararCifrado(cifrado, mascararCpf), '***.***.***-25')
assert.equal(mascararCifrado(null, mascararCpf), null)
process.env.LGPD_CHAVE_CIFRA = Buffer.alloc(32, 1).toString('base64')
assert.equal(mascararCifrado(cifrado, mascararCpf), null)

console.log('lgpd-documentos: ok')
