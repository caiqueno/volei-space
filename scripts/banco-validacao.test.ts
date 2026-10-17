import assert from 'node:assert/strict'
import { validarPapeletaDoBanco, type JogadorBanco } from '../src/lib/banco/papeleta-validacao'
import { validarPedidoDoBanco } from '../src/lib/banco/pedidos-validacao'
import { gerarTokenBanco, hashesIguais, hashTokenBanco, tabelaBancoAusente, tokenBancoValido } from '../src/lib/banco/base'
import { setAtual, setJaIniciado } from '../src/lib/banco/dados'

const elenco: JogadorBanco[] = Array.from({ length: 12 }, (_, i) => ({ jogadorId: 11 + i, nome: `Atleta ${i + 1}`, numero: i + 1 }))
const formacao = (ids: number[]) => ids.map((jogadorId, i) => ({ posicao: i + 1, jogadorId }))
const codigos = (v: Array<{ codigo: string }>) => v.map((x) => x.codigo)

// Papeleta válida
assert.deepEqual(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 20, capitaoId: 11 }, elenco), [])
assert.deepEqual(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]) }, elenco), [])

// Titulares repetidos
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 11, 13, 14, 15, 16]) }, elenco)).includes('RG-FOR-005'))
// Posição repetida e fora de faixa
assert.ok(codigos(validarPapeletaDoBanco({ formacao: [...formacao([11, 12, 13, 14, 15]), { posicao: 5, jogadorId: 16 }] }, elenco)).includes('RG-FOR-005'))
assert.ok(codigos(validarPapeletaDoBanco({ formacao: [...formacao([11, 12, 13, 14, 15]), { posicao: 7, jogadorId: 16 }] }, elenco)).includes('RG-FOR-005'))
// Jogador fora do elenco
const fora = validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 99]) }, elenco)
assert.ok(codigos(fora).includes('RG-FOR-009'))
assert.ok(fora.every((v) => v.mensagem.length > 10))
// Líbero entre os titulares
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 12 }, elenco)).includes('RG-LIB-002'))
// Líbero fora da relação
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 99 }, elenco)).includes('RG-LIB-001'))
// Capitão fora de quadra e fora do elenco
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), capitaoId: 20 }, elenco)).includes('RG-ELE-005'))
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), capitaoId: 99 }, elenco)).includes('RG-FOR-009'))
// Camisa repetida
const repetido = elenco.map((j, i) => (i === 1 ? { ...j, numero: 1 } : j))
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]) }, repetido)).includes('RG-ELE-004'))
// Formação incompleta
assert.ok(codigos(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13]) }, elenco)).includes('RG-FOR-005'))

// Pedidos
const perfil = { temposPorSet: 2, limiteSubstituicoesPorSet: 6 }
const base = { setNumero: 1, perfil, elenco }
const aceito = (tipo: string, n = 1) => Array.from({ length: n }, () => ({ tipo, estado: 'ACEITO', payload: { setNumero: 1 } }))
assert.deepEqual(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO' }, pedidos: [] }), [])
assert.deepEqual(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO' }, pedidos: aceito('TEMPO', 1) }), [])
assert.equal(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO' }, pedidos: aceito('TEMPO', 2) })[0]?.codigo, 'RG-TMP-001')
assert.equal(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 17 }, pedidos: aceito('SUBSTITUICAO', 6) })[0]?.codigo, 'RG-SUB-001')
// Aceitos de outro set não contam
assert.deepEqual(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO' }, pedidos: [{ tipo: 'TEMPO', estado: 'ACEITO', payload: { setNumero: 2 } }, { tipo: 'TEMPO', estado: 'ACEITO', payload: { setNumero: 2 } }] }), [])
// Estrutura
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO' }, pedidos: [] }).length > 0)
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 11 }, pedidos: [] }).length > 0)
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 99 }, pedidos: [] }).length > 0)
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO', sai: 11 }, pedidos: [] }).length > 0)
// Quem sai precisa estar em quadra segundo a papeleta
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 17, entra: 18 }, pedidos: [], titulares: [11, 12, 13, 14, 15, 16] }).length > 0)
// Segundo pedido de substituição pendente na mesma interrupção
assert.equal(
  validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 17 }, pedidos: [{ tipo: 'SUBSTITUICAO', estado: 'PENDENTE', payload: { setNumero: 1 } }] })[0]?.codigo,
  'RG-TMP-003',
)

// Token
const t = gerarTokenBanco()
assert.ok(tokenBancoValido(t))
assert.ok(!tokenBancoValido('curto'))
assert.ok(!tokenBancoValido('123456789012345678901234567890123/'))
assert.notEqual(t, gerarTokenBanco())
assert.ok(hashesIguais(hashTokenBanco(t), hashTokenBanco(t)))
assert.ok(!hashesIguais(hashTokenBanco(t), hashTokenBanco(t + 'x')))
assert.ok(!hashesIguais(undefined, 'a'))
assert.ok(tabelaBancoAusente({ code: '42P01', message: 'relation "public.Papeleta" does not exist' }))
assert.ok(!tabelaBancoAusente({ code: '23505', message: 'duplicate' }))

// Set
assert.equal(setAtual([]), 1)
assert.equal(setAtual([{ numero: 1 }, { numero: 2 }]), 3)
assert.equal(setJaIniciado({ status: 'AGENDADA' }, [], 1), false)
assert.equal(setJaIniciado({ status: 'AGENDADA' }, [{ numero: 1 }], 1), true)
assert.equal(setJaIniciado({ status: 'AGENDADA' }, [{ numero: 1 }], 2), false)
assert.equal(setJaIniciado({ status: 'ENCERRADA' }, [], 3), true)

console.log('banco-validacao: ok')
