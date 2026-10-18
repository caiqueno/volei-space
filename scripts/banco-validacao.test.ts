import assert from 'node:assert/strict'
import { PERFIL_FIVB_COMPETICAO, PERFIL_FIVB_CBV } from '../src/lib/regras-volei'
import { avisosDaPapeleta, validarPapeletaDoBanco, type JogadorBanco } from '../src/lib/banco/papeleta-validacao'
import { quadraAtual, usoDoSet, validarPedidoDoBanco } from '../src/lib/banco/pedidos-validacao'
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
// R3: capitão no banco NÃO bloqueia (basta estar na relação nominal); só avisa. Fora da relação bloqueia.
assert.deepEqual(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), capitaoId: 20 }, elenco), [])
assert.deepEqual(codigos(avisosDaPapeleta({ formacao: formacao([11, 12, 13, 14, 15, 16]), capitaoId: 20 })), ['RG-ELE-005'])
assert.deepEqual(avisosDaPapeleta({ formacao: formacao([11, 12, 13, 14, 15, 16]), capitaoId: 11 }), [])
// Líbero pode ser capitão
assert.deepEqual(validarPapeletaDoBanco({ formacao: formacao([11, 12, 13, 14, 15, 16]), liberoId: 20, capitaoId: 20 }, elenco), [])
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

// R1: quem sai é conferido contra a QUADRA ATUAL (papeleta + trocas aceitas), permitindo o retorno B->A
const titulares = [11, 12, 13, 14, 15, 16]
const trocaAceita = (sai: number, entra: number, quando: string) => ({ tipo: 'SUBSTITUICAO', estado: 'ACEITO', decididoEm: quando, payload: { setNumero: 1, sai, entra } })
const aToB = trocaAceita(11, 17, '2026-01-01T10:00:00Z')
assert.deepEqual(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 17 }, pedidos: [], titulares }), [])
assert.deepEqual(quadraAtual(titulares, [aToB], 1), [17, 12, 13, 14, 15, 16])
// depois de A->B aceito, B->A passa; A->C já não (A saiu) e sai=A é recusado
assert.deepEqual(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 17, entra: 11 }, pedidos: [aToB], titulares }), [])
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 18 }, pedidos: [aToB], titulares }).length > 0, 'A já saiu')
// entra já em quadra é recusado
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 12 }, pedidos: [], titulares }).length > 0)
// trocas pendentes ou de outro set não mudam a quadra
assert.deepEqual(quadraAtual(titulares, [{ ...aToB, estado: 'PENDENTE' }, { ...aToB, payload: { setNumero: 2, sai: 11, entra: 17 } }], 1), titulares)
// sem papeleta: não há como saber a quadra
assert.equal(quadraAtual(null, [aToB], 1), null)
// líbero 2 também não entra por pedido
assert.ok(validarPedidoDoBanco({ ...base, entrada: { tipo: 'SUBSTITUICAO', sai: 11, entra: 19 }, pedidos: [], titulares, libero2Id: 19 }).length > 0)

// R5: limite pelo log efetivo da súmula + aceitos ainda não lançados
const semLog = usoDoSet({ pedidos: [trocaAceita(11, 17, 'a'), ...aceito('TEMPO', 1)], setNumero: 1 })
assert.deepEqual(semLog, { tempos: 1, substituicoes: 1 })
// o apontador lançou 2 tempos direto na súmula (sem pedido): o banco não pode pedir o terceiro
const comLog = usoDoSet({ pedidos: [], setNumero: 1, log: { tempos: 2, substituicoes: 0, trocas: [] } })
assert.deepEqual(comLog, { tempos: 2, substituicoes: 0 })
assert.equal(validarPedidoDoBanco({ ...base, entrada: { tipo: 'TEMPO' }, pedidos: [], uso: comLog })[0]?.codigo, 'RG-TMP-001')
// pedido aceito já lançado não conta duas vezes; o não lançado soma
const dois = usoDoSet({
  pedidos: [trocaAceita(11, 17, 'a'), trocaAceita(12, 18, 'b'), ...aceito('TEMPO', 1)],
  setNumero: 1,
  log: { tempos: 1, substituicoes: 3, trocas: [{ sai: 11, entra: 17 }, { sai: 13, entra: 19 }, { sai: 14, entra: 20 }] },
})
assert.deepEqual(dois, { tempos: 1, substituicoes: 4 }, '3 do log + a troca 12->18 ainda não lançada')
// tempo aceito e ainda não lançado soma ao log
assert.deepEqual(usoDoSet({ pedidos: aceito('TEMPO', 2), setNumero: 1, log: { tempos: 1, substituicoes: 0, trocas: [] } }), { tempos: 2, substituicoes: 0 })

// R4: elenco pelo perfil (14 jogadores, 2 líberos acima de 12) e categoria da violação
const elenco14: JogadorBanco[] = Array.from({ length: 14 }, (_, i) => ({ jogadorId: 11 + i, nome: `Atleta ${i + 1}`, numero: i + 1 }))
const f14 = { formacao: formacao([11, 12, 13, 14, 15, 16]) }
const sem14 = validarPapeletaDoBanco(f14, elenco14, { perfil: PERFIL_FIVB_CBV })
assert.ok(sem14.some((v) => v.codigo === 'RG-ELE-001' && v.categoria === 'ELENCO'), '14 acima do limite de 12 no perfil comum')
const com14 = validarPapeletaDoBanco({ ...f14, liberoId: 24 }, elenco14, { perfil: PERFIL_FIVB_COMPETICAO })
assert.ok(com14.some((v) => v.codigo === 'RG-LIB-001' && v.categoria === 'ELENCO'), 'acima de 12 exige dois líberos')
assert.deepEqual(validarPapeletaDoBanco({ ...f14, liberoId: 24, libero2Id: 23 }, elenco14, { perfil: PERFIL_FIVB_COMPETICAO }), [])
// camisa fora de 1 a 20 e camisa repetida são de ELENCO; líbero entre titulares é de FORMACAO
assert.ok(validarPapeletaDoBanco(f14, elenco.map((j, i) => (i === 0 ? { ...j, numero: 25 } : j))).some((v) => v.codigo === 'RG-ELE-004' && v.categoria === 'ELENCO'))
assert.ok(validarPapeletaDoBanco({ ...f14, liberoId: 12 }, elenco).some((v) => v.codigo === 'RG-LIB-002' && v.categoria === 'FORMACAO'))
// segundo líbero: repetido, ou sem o primeiro, ou fora da relação
assert.ok(validarPapeletaDoBanco({ ...f14, liberoId: 20, libero2Id: 20 }, elenco).some((v) => v.codigo === 'RG-LIB-001'))
assert.ok(validarPapeletaDoBanco({ ...f14, libero2Id: 20 }, elenco).some((v) => v.codigo === 'RG-LIB-001'))
assert.ok(validarPapeletaDoBanco({ ...f14, liberoId: 20, libero2Id: 99 }, elenco).some((v) => v.codigo === 'RG-LIB-001'))
assert.ok(validarPapeletaDoBanco({ ...f14, liberoId: 20, libero2Id: 13 }, elenco).some((v) => v.codigo === 'RG-LIB-002'), 'segundo líbero não pode ser titular')
// toda violação da papeleta traz a categoria
for (const v of validarPapeletaDoBanco({ formacao: formacao([11, 11, 99, 14, 15, 16]), liberoId: 99, capitaoId: 98 }, repetido)) assert.ok(v.categoria === 'ELENCO' || v.categoria === 'FORMACAO', v.codigo)

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

// I1: set em disputa = linha 0x0 (ou parcial) ainda não encerrada pelo placar
const regras = { partidaEncerrada: false, alvoSet: 25, alvoDecisivo: 15, melhorDe: 3 }
assert.equal(setAtual([{ numero: 1, pontosA: 0, pontosB: 0 }], regras), 1, 'set 1 em andamento 0x0')
assert.equal(setAtual([{ numero: 1, pontosA: 12, pontosB: 9 }], regras), 1)
assert.equal(setAtual([{ numero: 1, pontosA: 25, pontosB: 20 }], regras), 2, 'set 1 acabou')
assert.equal(setAtual([{ numero: 1, pontosA: 25, pontosB: 24 }], regras), 1, 'sem vantagem de 2 ainda é o set 1')
assert.equal(setAtual([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 0, pontosB: 0 }], regras), 2)
assert.equal(setAtual([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 20, pontosB: 25 }, { numero: 3, pontosA: 14, pontosB: 13 }], regras), 3, 'decisivo vai a 15')
assert.equal(setAtual([{ numero: 1, pontosA: 25, pontosB: 20 }, { numero: 2, pontosA: 20, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 13 }], regras), 4)
assert.equal(setAtual([], regras), 1)
// partida encerrada ou sem opções: critério antigo (último set + 1)
assert.equal(setAtual([{ numero: 1, pontosA: 0, pontosB: 0 }]), 2)
assert.equal(setAtual([{ numero: 1, pontosA: 5, pontosB: 3 }], { ...regras, partidaEncerrada: true }), 2)

console.log('banco-validacao: ok')
