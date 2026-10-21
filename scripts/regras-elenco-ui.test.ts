/** Regras de elenco e pedidos de troca do organizador: lógica pura da tela. */
import assert from 'node:assert/strict'
import {
  aplicarModelo, ajustar, alternarDocumento, contarPedidosPendentes, corpoPut, elencoCompletoAtivo, explicacaoNascimento,
  formVazio, fraseResumo, iguais, itemAtivoPedidos, limparMotivo, normalizarModelos, normalizarPedidos, normalizarRegra,
  podeDecidirPedido, rotuloAtleta, rotuloContador, temErros, tratarResposta, urlDecidirPedido, urlPedidos, validarForm, MOTIVO_MAX,
} from '../src/lib/regras-elenco-ui'

// Flag: só '1'.
assert.equal(elencoCompletoAtivo('1'), true)
assert.equal(elencoCompletoAtivo('true'), false)
assert.equal(elencoCompletoAtivo(undefined), false)

// Modelos: normaliza, ordena e marca o não confirmado.
const modelos = normalizarModelos({
  data: [
    { modelo: 'PERSONALIZADO', nome: 'Personalizado', descricao: 'Você define', confirmado: true, valores: {} },
    { modelo: 'CBV', nome: 'Padrão CBV', descricao: 'd', confirmado: false, valores: { atletasMin: 6, atletasMax: 14, liberosMax: 2, nascimentoDe: '2008-01-01T00:00:00Z', nascimentoAte: '2010-12-31', documentosExigidos: ['foto', 'CPF', 'xx'], comissaoMax: 5 } },
    { modelo: 'INVALIDO', valores: {} },
    { modelo: 'FIVB', valores: { atletasMin: 6, atletasMax: 12 } },
  ],
})
assert.deepEqual(modelos.map((m) => m.modelo), ['FIVB', 'CBV', 'PERSONALIZADO'])
assert.equal(modelos[0].nome, 'Padrão FIVB')
assert.equal(modelos[0].confirmado, true)
assert.equal(modelos[1].confirmado, false)
assert.equal(modelos[1].valores.nascimentoDe, '2008-01-01')
assert.deepEqual(modelos[1].valores.documentosExigidos, ['FOTO', 'CPF'])
assert.deepEqual(normalizarModelos(null), [])

// Preenchimento por modelo mantém prazo e consentimento.
const base = { ...formVazio(), prazoTrocaEm: '2026-11-01T15:00:00.000Z', exigeConsentimentoMenor: true }
const cbv = aplicarModelo(base, modelos[1])
assert.equal(cbv.modelo, 'CBV')
assert.equal(cbv.atletasMin, '6')
assert.equal(cbv.atletasMax, '14')
assert.equal(cbv.liberosMax, '2')
assert.equal(cbv.nascimentoDe, '2008-01-01')
assert.equal(cbv.comissaoMax, '5')
assert.deepEqual(cbv.documentosExigidos, ['FOTO', 'CPF'])
assert.equal(cbv.prazoTrocaEm, base.prazoTrocaEm)
assert.equal(cbv.exigeConsentimentoMenor, true)
// Personalizado vazio não apaga o que já foi digitado.
assert.equal(aplicarModelo(cbv, modelos[2]).atletasMin, '6')
assert.equal(aplicarModelo(cbv, modelos[2]).modelo, 'PERSONALIZADO')

// Ajuste manual vira Personalizado; prazo e consentimento não.
assert.equal(ajustar(cbv, { atletasMax: '15' }).modelo, 'PERSONALIZADO')
assert.equal(ajustar(cbv, { prazoTrocaEm: null }).modelo, 'CBV')
assert.equal(ajustar(cbv, { exigeConsentimentoMenor: false }).modelo, 'CBV')
assert.deepEqual(alternarDocumento(['FOTO'], 'CPF'), ['FOTO', 'CPF'])
assert.deepEqual(alternarDocumento(['FOTO', 'CPF'], 'FOTO'), ['CPF'])

// Validações.
assert.equal(temErros(validarForm(formVazio())), false)
assert.ok(validarForm({ ...formVazio(), atletasMin: '10', atletasMax: '6' }).atletasMax)
assert.ok(validarForm({ ...formVazio(), atletasMin: 'a' }).atletasMin)
assert.ok(validarForm({ ...formVazio(), atletasMin: '0' }).atletasMin)
assert.ok(validarForm({ ...formVazio(), atletasMin: '100' }).atletasMin)
assert.equal(validarForm({ ...formVazio(), liberosMax: '0' }).liberosMax, undefined)
assert.ok(validarForm({ ...formVazio(), atletasMax: '6', liberosMax: '7' }).liberosMax)
assert.ok(validarForm({ ...formVazio(), nascimentoDe: '2010-01-01', nascimentoAte: '2008-01-01' }).nascimento)
assert.equal(validarForm({ ...formVazio(), nascimentoDe: '2008-01-01', nascimentoAte: '2008-01-01' }).nascimento, undefined)
assert.equal(temErros(validarForm(cbv)), false)

// Explicação da faixa e frase de resumo.
assert.equal(explicacaoNascimento('2008-01-01', '2010-12-31'), 'Pode jogar quem nasceu entre 01/01/2008 e 31/12/2010.')
assert.match(explicacaoNascimento('2008-01-01', ''), /a partir de 01\/01\/2008/)
assert.match(explicacaoNascimento('', '2010-12-31'), /até 31\/12\/2010/)
assert.match(explicacaoNascimento('', ''), /Sem limite/)
const frase = fraseResumo({ ...cbv, prazoTrocaEm: null, exigeConsentimentoMenor: true })
assert.match(frase, /^Seu time precisa ter de 6 a 14 atletas\./)
assert.match(frase, /até 2 líberos/)
assert.match(frase, /até 5 pessoas/)
assert.match(frase, /foto e cpf/)
assert.match(frase, /autorização do responsável/)
assert.match(fraseResumo(formVazio()), /Não há limite de atletas/)
assert.match(fraseResumo(formVazio()), /Nenhum documento/)
assert.match(fraseResumo({ ...formVazio(), atletasMin: '6' }), /pelo menos 6/)
assert.match(fraseResumo({ ...formVazio(), liberosMax: '0' }), /Não é permitido inscrever líbero/)
assert.match(fraseResumo({ ...formVazio(), prazoTrocaEm: '2026-11-01T15:00:00.000Z' }), /Trocas de atletas podem ser pedidas até/)

// Corpo do PUT: omite vazios, envia números.
const put = corpoPut({ ...cbv, atletasMin: '6', atletasMax: '', nascimentoAte: '', prazoTrocaEm: null })
assert.equal(put.modelo, 'CBV')
assert.equal(put.atletasMin, 6)
assert.ok(!('atletasMax' in put))
assert.ok(!('nascimentoAte' in put))
assert.ok(!('prazoTrocaEm' in put))
assert.deepEqual(put.documentosExigidos, ['FOTO', 'CPF'])
assert.equal(put.exigeConsentimentoMenor, true)
assert.equal(iguais(cbv, { ...cbv }), true)
assert.equal(iguais(cbv, ajustar(cbv, { atletasMax: '9' })), false)

// GET da regra: tolerante e detecta somente leitura.
const lido = normalizarRegra({ data: { modelo: 'amador_livre', atletasMin: 4, atletasMax: null, documentosExigidos: ['DOCUMENTO'], prazoTrocaEm: '2026-11-01T15:00:00.000Z', exigeConsentimentoMenor: true, campeonatoFinalizado: true } })
assert.equal(lido.form.modelo, 'AMADOR_LIVRE')
assert.equal(lido.form.atletasMin, '4')
assert.equal(lido.form.atletasMax, '')
assert.equal(lido.somenteLeitura, true)
assert.equal(normalizarRegra(null).form.modelo, 'PERSONALIZADO')
assert.equal(normalizarRegra({ data: { prazoTrocaEm: 'lixo' } }).form.prazoTrocaEm, null)
assert.equal(normalizarRegra({ data: {} }).somenteLeitura, false)

// Tratamento de status.
assert.equal(tratarResposta(200).ok, true)
assert.equal(tratarResposta(404).tipo, 'desligado')
assert.equal(tratarResposta(503).tipo, 'nao-habilitado')
const conflito = tratarResposta(409, { error: 'Já decidido' })
assert.equal(conflito.tipo, 'conflito')
assert.equal(conflito.recarregar, true)
assert.equal(conflito.mensagem, 'Já decidido')
assert.equal(tratarResposta(403).tipo, 'sessao')
assert.equal(tratarResposta(500, { error: 'falhou' }).mensagem, 'falhou')
assert.equal(tratarResposta(500).tipo, 'generica')

// Pedidos de troca.
const pedidos = normalizarPedidos({
  data: [
    { id: 1, equipe: { id: 'e', nome: 'Time A' }, categoria: 'Adulto', campeonato: 'Copa', sai: { id: 'a', numero: 7, nomeAbreviado: 'J. Silva' }, entra: { id: 'b', nomeAbreviado: 'M. Souza' }, motivo: 'Lesão', estado: 'PENDENTE', criadoEm: '2026-10-01T12:00:00Z' },
    { id: 2, estado: 'XYZ' },
    { semId: true },
  ],
})
assert.equal(pedidos.length, 2)
assert.equal(pedidos[0].sai.numero, 7)
assert.equal(pedidos[0].entra.numero, null)
assert.equal(rotuloAtleta(pedidos[0].sai), 'J. Silva (camisa 7)')
assert.equal(rotuloAtleta(pedidos[0].entra), 'M. Souza')
assert.equal(pedidos[1].estado, 'PENDENTE')
assert.equal(pedidos[1].equipe.nome, 'Equipe')
assert.equal(contarPedidosPendentes(pedidos), 2)
assert.equal(podeDecidirPedido('PENDENTE'), true)
for (const e of ['APROVADO', 'RECUSADO', 'CANCELADO']) assert.equal(podeDecidirPedido(e), false)
assert.equal(urlPedidos('RECUSADO'), '/api/organizador/pedidos-troca?estado=RECUSADO')
assert.equal(urlDecidirPedido('a/b'), '/api/organizador/pedidos-troca/a%2Fb/decidir')
assert.equal(rotuloContador(0), '')
assert.equal(rotuloContador(5), '5')
assert.equal(rotuloContador(500), '99+')
assert.equal(limparMotivo('  '), undefined)
assert.equal(limparMotivo('x'.repeat(1000))?.length, MOTIVO_MAX)
assert.equal(itemAtivoPedidos('/painel/pedidos-troca'), true)
assert.equal(itemAtivoPedidos('/painel/solicitacoes'), false)

console.log('regras-elenco-ui: ok')
