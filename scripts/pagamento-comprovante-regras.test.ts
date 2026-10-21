// Regras puras do pagamento por comprovante (R19): validação da configuração da categoria e da decisão,
// transições do pagamento (idempotência e conflito), liberação da aprovação e valor mostrado no explorar.
import assert from 'node:assert/strict'
import {
  configDaLinha,
  configPagamentoSchema,
  decisaoPagamentoSchema,
  estadoLiberaAprovacao,
  exigeComprovante,
  mensagemPagamentoPendente,
  podeReceberComprovante,
  transicaoDoPagamento,
  valorInscricaoParaExplorar,
} from '../src/lib/pagamento-comprovante/regras'
import { montarCsv } from '../src/lib/painel-inscricoes/regras'
import { pagamentoComprovanteAtivo, recursoPagamentoAusente } from '../src/lib/pagamento-comprovante/config'

const ok = (corpo: unknown) => configPagamentoSchema.safeParse(corpo)

// --- Configuração da categoria -------------------------------------------------------------
assert.equal(ok({ modo: 'NENHUM' }).success, true)
assert.equal(ok({ modo: 'NENHUM', valorCentavos: 0 }).success, true, 'gratuito explícito')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 5000, pixChave: 'pix@time.com' }).success, true)
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 5000 }).success, false, 'COMPROVANTE exige chave Pix')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 5000, pixChave: '   ' }).success, false, 'chave só com espaços')
assert.equal(ok({ modo: 'COMPROVANTE', pixChave: 'x' }).success, false, 'COMPROVANTE exige valor')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 0, pixChave: 'x' }).success, false, 'valor zero não cobra')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: null, pixChave: 'x' }).success, false)
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: -1, pixChave: 'x' }).success, false)
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 10.5, pixChave: 'x' }).success, false, 'centavos inteiros')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: '5000', pixChave: 'x' }).success, false, 'número, não texto')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 10_000_001, pixChave: 'x' }).success, false, 'teto')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 10_000_000, pixChave: 'x' }).success, true)
assert.equal(ok({ modo: 'OUTRO' }).success, false)
assert.equal(ok({}).success, false)
assert.equal(ok({ modo: 'NENHUM', comprovantePath: 'x' }).success, false, 'campo desconhecido é recusado')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 1, pixChave: 'a'.repeat(140) }).success, true)
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 1, pixChave: 'a'.repeat(141) }).success, false, 'chave longa')
assert.equal(ok({ modo: 'COMPROVANTE', valorCentavos: 1, pixChave: 'a\nb' }).success, false, 'quebra de linha na chave')
assert.equal(ok({ modo: 'NENHUM', pixBeneficiario: 'b'.repeat(101) }).success, false)
assert.equal(ok({ modo: 'NENHUM', instrucoes: 'i'.repeat(501) }).success, false)
assert.equal(ok({ modo: 'NENHUM', instrucoes: 'i'.repeat(500) }).success, true)
const aparado = ok({ modo: 'COMPROVANTE', valorCentavos: 100, pixChave: '  chave  ', pixBeneficiario: '', instrucoes: '  ' })
assert.equal(aparado.success, true)
if (aparado.success) {
  assert.equal(aparado.data.pixChave, 'chave', 'espaços aparados')
  assert.equal(aparado.data.pixBeneficiario, null, 'vazio vira nulo')
  assert.equal(aparado.data.instrucoes, null)
}

// --- Decisão ---------------------------------------------------------------------------------
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'CONFIRMAR' }).success, true)
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'ISENTAR' }).success, true)
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'RECUSAR' }).success, false, 'RECUSAR exige motivo')
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'RECUSAR', motivo: '   ' }).success, false)
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'RECUSAR', motivo: 'ilegível' }).success, true)
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'RECUSAR', motivo: 'm'.repeat(501) }).success, false)
assert.equal(decisaoPagamentoSchema.safeParse({ decisao: 'PAGAR' }).success, false)

// --- Transições ----------------------------------------------------------------------------------
assert.deepEqual(transicaoDoPagamento('CONFIRMAR', 'COMPROVANTE_ENVIADO'), { tipo: 'aplicar', destino: 'CONFIRMADO' })
assert.deepEqual(transicaoDoPagamento('RECUSAR', 'COMPROVANTE_ENVIADO'), { tipo: 'aplicar', destino: 'RECUSADO' })
assert.deepEqual(transicaoDoPagamento('ISENTAR', 'PENDENTE'), { tipo: 'aplicar', destino: 'ISENTO' })
assert.deepEqual(transicaoDoPagamento('ISENTAR', 'RECUSADO'), { tipo: 'aplicar', destino: 'ISENTO' })
assert.equal(transicaoDoPagamento('CONFIRMAR', 'CONFIRMADO').tipo, 'repetida')
assert.equal(transicaoDoPagamento('RECUSAR', 'RECUSADO').tipo, 'repetida')
assert.equal(transicaoDoPagamento('ISENTAR', 'ISENTO').tipo, 'repetida')
assert.equal(transicaoDoPagamento('RECUSAR', 'CONFIRMADO').tipo, 'conflito', 'decisão contrária')
assert.equal(transicaoDoPagamento('CONFIRMAR', 'RECUSADO').tipo, 'conflito')
assert.equal(transicaoDoPagamento('CONFIRMAR', 'ISENTO').tipo, 'conflito')
assert.equal(transicaoDoPagamento('ISENTAR', 'CONFIRMADO').tipo, 'conflito')
assert.equal(transicaoDoPagamento('CONFIRMAR', 'PENDENTE').tipo, 'conflito', 'não há comprovante para confirmar')
assert.equal(transicaoDoPagamento('RECUSAR', 'PENDENTE').tipo, 'conflito')

// --- Liberação da aprovação ------------------------------------------------------------------------
assert.equal(estadoLiberaAprovacao('CONFIRMADO'), true)
assert.equal(estadoLiberaAprovacao('ISENTO'), true)
for (const estado of ['PENDENTE', 'COMPROVANTE_ENVIADO', 'RECUSADO', null, undefined, 'xpto']) assert.equal(estadoLiberaAprovacao(estado as any), false)
assert.match(mensagemPagamentoPendente('PENDENTE'), /ainda não enviou o comprovante/)
assert.match(mensagemPagamentoPendente('COMPROVANTE_ENVIADO'), /ainda não foi confirmado/)
assert.match(mensagemPagamentoPendente('RECUSADO', 'borrado'), /recusado \(borrado\)/)
assert.equal(podeReceberComprovante('PENDENTE'), true)
assert.equal(podeReceberComprovante('RECUSADO'), true)
assert.equal(podeReceberComprovante('COMPROVANTE_ENVIADO'), true)
assert.equal(podeReceberComprovante('CONFIRMADO'), false)
assert.equal(podeReceberComprovante('ISENTO'), false)

// --- Configuração lida do banco e valor do explorar ----------------------------------------------------
assert.deepEqual(configDaLinha(null), { modo: 'NENHUM', valorCentavos: null, pixChave: null, pixBeneficiario: null, instrucoes: null })
assert.deepEqual(configDaLinha({ pagamentoModo: 'XPTO', valorInscricaoCentavos: 'abc' }).modo, 'NENHUM')
assert.equal(configDaLinha({ valorInscricaoCentavos: 0 }).valorCentavos, 0, 'zero explícito é mantido')
assert.equal(configDaLinha({ valorInscricaoCentavos: null }).valorCentavos, null)
assert.equal(configDaLinha({ valorInscricaoCentavos: -5 }).valorCentavos, null)
assert.equal(exigeComprovante(configDaLinha({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 1 })), true)
assert.equal(exigeComprovante(configDaLinha({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 0 })), false)
assert.equal(exigeComprovante(configDaLinha({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: null })), false)
assert.equal(exigeComprovante(configDaLinha({ pagamentoModo: 'NENHUM', valorInscricaoCentavos: 5000 })), false)
assert.equal(valorInscricaoParaExplorar(configDaLinha(null)), null, 'não definido')
assert.equal(valorInscricaoParaExplorar(configDaLinha({ pagamentoModo: 'NENHUM', valorInscricaoCentavos: 0 })), 0, 'Gratuito')
assert.equal(valorInscricaoParaExplorar(configDaLinha({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 0 })), null, 'cobrança com zero nunca é Gratuito')
assert.equal(valorInscricaoParaExplorar(configDaLinha({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 12550 })), 125.5)
assert.equal(valorInscricaoParaExplorar(configDaLinha({ pagamentoModo: 'NENHUM', valorInscricaoCentavos: 3000 })), 30)

// --- Flag e recurso ausente --------------------------------------------------------------------------------
assert.equal(pagamentoComprovanteAtivo({}), false)
assert.equal(pagamentoComprovanteAtivo({ PAGAMENTO_COMPROVANTE_ATIVO: '0' }), false)
assert.equal(pagamentoComprovanteAtivo({ PAGAMENTO_COMPROVANTE_ATIVO: '1' }), true)
assert.equal(recursoPagamentoAusente({ code: '42P01', message: 'relation "PagamentoInscricao" does not exist' }), true)
assert.equal(recursoPagamentoAusente({ code: '42703', message: 'column pagamentoModo does not exist' }), true)
assert.equal(recursoPagamentoAusente({ code: 'PGRST204', message: "Could not find the 'pixChave' column" }), true)
assert.equal(recursoPagamentoAusente({ code: '23505', message: 'duplicate key' }), false)
assert.equal(recursoPagamentoAusente(null), false)

// --- CSV: coluna extra só com a flag; sem comprovante nem chave Pix -------------------------------------------
assert.ok(montarCsv([]).includes('atualizado em\r\n'), 'sem a opção o cabeçalho é o de sempre')
assert.ok(montarCsv([], { comPagamento: true }).includes('atualizado em;pagamento\r\n'))
assert.ok(!montarCsv([['a']], { comPagamento: true }).match(/comprovante|pix/i))

console.log('pagamento-comprovante-regras: ok')
