import assert from 'node:assert/strict'
import {
  avisoAprovarBloqueado, botoesDoPagamento, ehPagamentoPendente, mensagemDaAprovacao, centavosParaReais, corpoConfig, corpoDecisaoPagamento, etiquetaDaLista, extrairPagamentosDaLista,
  falhaEscondeArea, formatarReais, fraseResumo, liderPodeEnviarComprovante, liderPodeTrocarComprovante, mascaraReais, MENSAGEM_PAGAMENTO_PENDENTE,
  montarConfirmacaoComprovante, montarPedidoComprovante, normalizarConfig, normalizarPagamentoLider, normalizarPagamentoOrganizador,
  pagamentoBloqueiaAprovar, pagamentoComprovanteAtivo, pagamentoDasRegras, podeDecidirPagamento, reaisParaCentavos, rotuloEstadoOrganizador, textoEstadoLider,
  tratarRespostaPagamento, urlComprovanteSegura, validarConfig, validarDecisaoPagamento, CONFIG_VAZIA, type ConfigPagamento,
} from '../src/lib/pagamento-comprovante-ui'

// flag
assert.equal(pagamentoComprovanteAtivo('1'), true)
assert.equal(pagamentoComprovanteAtivo('0'), false)
assert.equal(pagamentoComprovanteAtivo('true'), false)
assert.equal(pagamentoComprovanteAtivo(undefined), false)
assert.equal(pagamentoComprovanteAtivo(null), false)

// reais <-> centavos
assert.equal(reaisParaCentavos('150'), 15000)
assert.equal(reaisParaCentavos('150,00'), 15000)
assert.equal(reaisParaCentavos('150,5'), 15050)
assert.equal(reaisParaCentavos('R$ 1.234,56'), 123456)
assert.equal(reaisParaCentavos('1.234'), 123400)
assert.equal(reaisParaCentavos('0,99'), 99)
assert.equal(reaisParaCentavos(',50'), 50)
assert.equal(reaisParaCentavos(''), null)
assert.equal(reaisParaCentavos('abc'), null)
assert.equal(reaisParaCentavos('1,234'), null)
assert.equal(reaisParaCentavos('-5'), null)
assert.equal(reaisParaCentavos('1,2,3'), null)
assert.equal(centavosParaReais(15000), '150,00')
assert.equal(centavosParaReais(123456), '1.234,56')
assert.equal(centavosParaReais(5), '0,05')
assert.equal(centavosParaReais(-1), '0,00')
assert.equal(formatarReais(15000), 'R$ 150,00')
for (const c of [1, 99, 100, 15000, 123456, 9999999]) assert.equal(reaisParaCentavos(centavosParaReais(c)), c)

// máscara
assert.equal(mascaraReais(''), '')
assert.equal(mascaraReais('a'), '')
assert.equal(mascaraReais('1'), '0,01')
assert.equal(mascaraReais('15'), '0,15')
assert.equal(mascaraReais('15000'), '150,00')
assert.equal(mascaraReais('0,01'), '0,01')
assert.equal(mascaraReais('R$ 150,00'), '150,00')
assert.equal(mascaraReais('1234567890123'), '1.234.567,89')

// configuração
const ativa: ConfigPagamento = { modo: 'COMPROVANTE', valor: '150,00', pixChave: ' a@b.com ', pixBeneficiario: ' Liga X ', instrucoes: ' ' }
assert.deepEqual(validarConfig(CONFIG_VAZIA), {})
assert.deepEqual(validarConfig(ativa), {})
assert.ok(validarConfig({ ...ativa, valor: '' }).valor)
assert.ok(validarConfig({ ...ativa, valor: '0,00' }).valor)
assert.ok(validarConfig({ ...ativa, valor: '999.999,00' }).valor)
assert.ok(validarConfig({ ...ativa, pixChave: '  ' }).pixChave)
assert.ok(validarConfig({ ...ativa, pixBeneficiario: '' }).pixBeneficiario)
assert.ok(validarConfig({ ...ativa, instrucoes: 'x'.repeat(501) }).instrucoes)
assert.deepEqual(corpoConfig(ativa), { modo: 'COMPROVANTE', valorCentavos: 15000, pixChave: 'a@b.com', pixBeneficiario: 'Liga X' })
assert.deepEqual(corpoConfig({ ...ativa, instrucoes: ' Mande até sexta ' }).instrucoes, 'Mande até sexta')
assert.deepEqual(corpoConfig({ ...ativa, modo: 'NENHUM' }), { modo: 'NENHUM' })
assert.equal(
  fraseResumo(ativa),
  'Cada time paga R$ 150,00 por Pix e envia o comprovante; você confirma antes de aprovar.',
)
assert.match(fraseResumo(CONFIG_VAZIA), /Sem cobrança/)
assert.deepEqual(normalizarConfig({ data: { modo: 'COMPROVANTE', valorCentavos: 15000, pixChave: 'k', pixBeneficiario: 'b', instrucoes: 'i' } }), {
  modo: 'COMPROVANTE', valor: '150,00', pixChave: 'k', pixBeneficiario: 'b', instrucoes: 'i',
})
assert.deepEqual(normalizarConfig(null), CONFIG_VAZIA)
assert.deepEqual(normalizarConfig({ data: { modo: 'qualquer' } }), CONFIG_VAZIA)

// rótulos de estado
assert.equal(rotuloEstadoOrganizador('PENDENTE'), 'Aguardando pagamento')
assert.equal(textoEstadoLider('PENDENTE').rotulo, 'Aguardando seu pagamento')
assert.equal(textoEstadoLider('COMPROVANTE_ENVIADO').rotulo, 'Comprovante enviado, aguardando o organizador')
assert.equal(textoEstadoLider('CONFIRMADO').tom, 'ok')
assert.equal(textoEstadoLider('ISENTO').rotulo, 'Isento')
const recusado = textoEstadoLider('RECUSADO', 'Foto cortada')
assert.equal(recusado.tom, 'erro')
assert.match(recusado.explicacao, /Foto cortada/)
assert.match(recusado.explicacao, /Envie outro/)
assert.match(textoEstadoLider('RECUSADO', null).explicacao, /Envie outro/)

// normalização
assert.equal(normalizarPagamentoOrganizador({ data: { estado: 'XYZ' } }), null)
assert.deepEqual(normalizarPagamentoOrganizador({ data: { valorCentavos: 15000, estado: 'comprovante_enviado', comprovanteEnviadoEm: '2026-01-01T10:00:00Z' } }), {
  valorCentavos: 15000, estado: 'COMPROVANTE_ENVIADO', comprovanteEnviadoEm: '2026-01-01T10:00:00Z', decididoEm: null, motivoRecusa: null,
})
assert.equal(normalizarPagamentoLider(null), null)
const lider = normalizarPagamentoLider({ data: { exige: true, valorCentavos: 5000, pix: { chave: 'k', beneficiario: 'b', instrucoes: 'i' }, estado: 'RECUSADO', motivoRecusa: 'm', comprovanteEnviado: true } })
assert.ok(lider)
assert.equal(lider.exige, true)
assert.equal(lider.pix.chave, 'k')
assert.equal(lider.estado, 'RECUSADO')
assert.equal(liderPodeEnviarComprovante(lider), true)
assert.equal(liderPodeEnviarComprovante({ exige: true, estado: 'PENDENTE' }), true)
assert.equal(liderPodeEnviarComprovante({ exige: true, estado: 'CONFIRMADO' }), false)
assert.equal(liderPodeEnviarComprovante({ exige: false, estado: 'PENDENTE' }), false)
assert.equal(liderPodeTrocarComprovante({ exige: true, estado: 'COMPROVANTE_ENVIADO' }), true)
assert.equal(liderPodeTrocarComprovante({ exige: true, estado: 'ISENTO' }), false)

// regras da categoria (antes da inscrição)
assert.equal(pagamentoDasRegras(null), null)
assert.equal(pagamentoDasRegras({ data: { nome: 'x' } }), null)
assert.equal(pagamentoDasRegras({ data: { pagamento: { exige: false, valorCentavos: 100 } } }), null)
assert.equal(pagamentoDasRegras({ data: { pagamento: { exige: true, valorCentavos: 15000, pix: { chave: 'k', beneficiario: 'b', instrucoes: '' } } } })?.pix.chave, 'k')

// lista
const lista = extrairPagamentosDaLista({ data: { itens: [
  { id: 'a', pagamento: { estado: 'PENDENTE', valorCentavos: 15000 } },
  { id: 'b' },
  { id: 'c', pagamento: { estado: 'lixo' } },
  { id: 7, pagamento: { estado: 'CONFIRMADO', valorCentavos: 100 } },
] } })
assert.deepEqual(Object.keys(lista).sort(), ['7', 'a'])
assert.equal(etiquetaDaLista(lista.a), 'Aguardando pagamento · R$ 150,00')
assert.deepEqual(extrairPagamentosDaLista(null), {})
assert.equal(pagamentoBloqueiaAprovar('PENDENTE'), true)
assert.equal(pagamentoBloqueiaAprovar('COMPROVANTE_ENVIADO'), true)
assert.equal(pagamentoBloqueiaAprovar('RECUSADO'), true)
assert.equal(pagamentoBloqueiaAprovar('CONFIRMADO'), false)
assert.equal(pagamentoBloqueiaAprovar('ISENTO'), false)
assert.equal(pagamentoBloqueiaAprovar(undefined), false)
assert.match(avisoAprovarBloqueado('COMPROVANTE_ENVIADO'), /confirme o pagamento/)

// botões por estado e papel
const em = '2026-01-01T10:00:00Z'
assert.deepEqual(botoesDoPagamento('PENDENTE', 'ADMINISTRADOR', null), { confirmar: true, recusar: false, isentar: true, verComprovante: false })
assert.deepEqual(botoesDoPagamento('COMPROVANTE_ENVIADO', 'ADMINISTRADOR', em), { confirmar: true, recusar: true, isentar: true, verComprovante: true })
assert.deepEqual(botoesDoPagamento('CONFIRMADO', 'FINANCEIRO', em), { confirmar: false, recusar: false, isentar: false, verComprovante: true })
assert.deepEqual(botoesDoPagamento('RECUSADO', 'FINANCEIRO', em), { confirmar: true, recusar: false, isentar: true, verComprovante: true })
assert.deepEqual(botoesDoPagamento('ISENTO', 'ADMINISTRADOR', null), { confirmar: false, recusar: false, isentar: false, verComprovante: false })
assert.deepEqual(botoesDoPagamento('COMPROVANTE_ENVIADO', 'ARBITRAGEM', em), { confirmar: false, recusar: false, isentar: false, verComprovante: true })
assert.equal(botoesDoPagamento('COMPROVANTE_ENVIADO', null, em).confirmar, true)
assert.equal(podeDecidirPagamento('ARBITRAGEM'), false)
assert.equal(podeDecidirPagamento('FINANCEIRO'), true)

// decisão
assert.ok(validarDecisaoPagamento('RECUSAR', '  '))
assert.equal(validarDecisaoPagamento('RECUSAR', 'Valor errado'), null)
assert.equal(validarDecisaoPagamento('CONFIRMAR', ''), null)
assert.equal(validarDecisaoPagamento('ISENTAR', ''), null)
assert.ok(validarDecisaoPagamento('CONFIRMAR', 'x'.repeat(301)))
assert.deepEqual(corpoDecisaoPagamento('CONFIRMAR', 'ignorado'), { decisao: 'CONFIRMAR' })
assert.deepEqual(corpoDecisaoPagamento('RECUSAR', ' Valor errado '), { decisao: 'RECUSAR', motivo: 'Valor errado' })
assert.deepEqual(corpoDecisaoPagamento('ISENTAR', ''), { decisao: 'ISENTAR' })

// 404 / 503 / 409
assert.deepEqual(tratarRespostaPagamento(200), { ok: true })
const r404 = tratarRespostaPagamento(404)
assert.equal(r404.ok === false && r404.tipo, 'desligado')
const r503 = tratarRespostaPagamento(503)
assert.equal(r503.ok === false && r503.tipo, 'nao-habilitado')
const r409 = tratarRespostaPagamento(409, { error: 'x', codigo: 'PAGAMENTO_PENDENTE' })
assert.equal(r409.ok === false && r409.tipo, 'pagamento-pendente')
assert.equal(r409.ok === false && r409.mensagem, MENSAGEM_PAGAMENTO_PENDENTE)
assert.equal(r409.ok === false && r409.recarregar, true)
const r409b = tratarRespostaPagamento(409, { error: 'Mudou' })
assert.equal(r409b.ok === false && r409b.tipo, 'conflito')
assert.equal(r409b.ok === false && r409b.mensagem, 'Mudou')
assert.equal(tratarRespostaPagamento(401).ok, false)
const r400 = tratarRespostaPagamento(400, { error: 'Motivo obrigatório.' })
assert.equal(r400.ok === false && r400.mensagem, 'Motivo obrigatório.')
const r500 = tratarRespostaPagamento(500, { error: 'secret stack' })
assert.equal(r500.ok === false && r500.tipo, 'generica')
assert.equal(ehPagamentoPendente(409, { codigo: 'PAGAMENTO_PENDENTE' }), true)
assert.equal(ehPagamentoPendente(409, { codigo: 'OUTRO' }), false)
assert.equal(ehPagamentoPendente(400, { codigo: 'PAGAMENTO_PENDENTE' }), false)
assert.equal(ehPagamentoPendente(409, null), false)
assert.equal(mensagemDaAprovacao(409, { codigo: 'PAGAMENTO_PENDENTE' }, 'padrão'), MENSAGEM_PAGAMENTO_PENDENTE)
assert.equal(mensagemDaAprovacao(409, { codigo: 'X' }, 'padrão'), 'padrão')
assert.equal(mensagemDaAprovacao(200, null, 'padrão'), 'padrão')
assert.equal(falhaEscondeArea('desligado'), true)
assert.equal(falhaEscondeArea('nao-habilitado'), true)
assert.equal(falhaEscondeArea('conflito'), false)

// URL do comprovante
assert.equal(urlComprovanteSegura('https://x.supabase.co/a?token=1'), 'https://x.supabase.co/a?token=1')
assert.equal(urlComprovanteSegura('http://x.co/a'), null)
assert.equal(urlComprovanteSegura('javascript:alert(1)'), null)
assert.equal(urlComprovanteSegura(null), null)
assert.equal(urlComprovanteSegura('não é url'), null)

// pedido de upload
const pedido = montarPedidoComprovante({ equipeId: 'e1', inscricaoId: 'i1', arquivo: { name: 'Comprovante Pix (1).jpg', type: 'image/jpeg', size: 1000 } })
assert.equal(pedido.tipo, 'COMPROVANTE')
assert.equal(pedido.inscricaoId, 'i1')
assert.match(pedido.nomeArquivo, /^[A-Za-z0-9._-]+$/)
assert.throws(() => montarPedidoComprovante({ equipeId: 'e1', inscricaoId: '', arquivo: { name: 'a.jpg', type: 'image/jpeg', size: 1 } }))
assert.deepEqual(montarConfirmacaoComprovante({ equipeId: 'e1', inscricaoId: 'i1' }, 'p/x.jpg'), { equipeId: 'e1', inscricaoId: 'i1', tipo: 'COMPROVANTE', path: 'p/x.jpg' })

console.log('pagamento-comprovante-ui: ok')
