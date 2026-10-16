import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { calculateCategoriesPrice } from '../src/lib/pricing/calculateCategoriesPrice'
import { linhasDoCheckout } from '../src/lib/pricing/linhas-checkout'
import { estruturaExigePagamentoConfirmado, pagamentoHabilitado } from '../src/lib/pagamento-config'
import { hrefDepoisDaConfiguracao } from '../src/lib/pagamento-navegacao'

function ler(relativo: string) {
  return fs.readFileSync(path.join(process.cwd(), relativo), 'utf8')
}

assert.equal(pagamentoHabilitado({}), true, 'sem a variável o checkout simulado permanece')
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: '' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: '   ' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'talvez' }), true, 'valor desconhecido não muda a produção')
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'false' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: '0' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'nao' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'não' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'off' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'no' }), false)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'true' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: ' TRUE ' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: '1' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'sim' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'yes' }), true)
assert.equal(pagamentoHabilitado({ PAGAMENTO_HABILITADO: 'on' }), true)

assert.equal(estruturaExigePagamentoConfirmado(null, {}), false, 'variável ausente não cria o 402')
assert.equal(estruturaExigePagamentoConfirmado(null, { PAGAMENTO_HABILITADO: '' }), false)
assert.equal(estruturaExigePagamentoConfirmado(null, { PAGAMENTO_HABILITADO: 'talvez' }), false)
assert.equal(estruturaExigePagamentoConfirmado(undefined, { PAGAMENTO_HABILITADO: 'false' }), false)
assert.equal(estruturaExigePagamentoConfirmado(null, { PAGAMENTO_HABILITADO: 'true' }), true, 'flag ligada e sem confirmação segura a estrutura')
assert.equal(estruturaExigePagamentoConfirmado('2026-10-10T00:00:00.000Z', { PAGAMENTO_HABILITADO: 'true' }), false)

assert.equal(hrefDepoisDaConfiguracao(4, false), '/painel/estrutura?ligaId=4')
assert.equal(hrefDepoisDaConfiguracao(4, true), '/painel/parametrizacao/pagamento?ligaId=4&cupom=')
assert.equal(hrefDepoisDaConfiguracao(4, true, 'OFF 10'), '/painel/parametrizacao/pagamento?ligaId=4&cupom=OFF%2010')

const categorias = calculateCategoriesPrice([{
  categoriaCampeonatoId: '00000000-0000-4000-8000-000000000001',
  config: { formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 6, quantidadeGrupos: 1, faseEliminatoria: 'NENHUMA' },
}])
const semItens = linhasDoCheckout(categorias)
assert.equal('items' in categorias, false)
assert.ok(semItens.length > 0, 'categories vira linhas e o map não quebra')
assert.equal(semItens[0].id, 'ativacao')
assert.doesNotThrow(() => semItens.map((item) => item.label + item.totalCents))

assert.deepEqual(linhasDoCheckout(undefined), [])
assert.deepEqual(linhasDoCheckout({}), [])
assert.deepEqual(linhasDoCheckout({ items: undefined, categories: undefined }), [])
assert.equal(linhasDoCheckout({ items: [{ key: 'ativacao', label: 'Ativação do campeonato', totalCents: 4900 }] })[0].id, 'ativacao')
assert.deepEqual(linhasDoCheckout({ categories: [{ subtotalCents: null, variableTotalCents: null }] }).filter((item) => item.id !== 'ativacao'), [])

const previa = ler('src/components/parametrizacao/pricing/PricingBreakdown.tsx')
const checkout = ler('src/components/parametrizacao/sections/pagamento/PagamentoView.tsx')
const resumo = ler('src/components/parametrizacao/pricing/PricingSummary.tsx')
const estrutura = ler('src/app/api/organizador/ligas/[id]/estrutura/route.ts')
const pagamento = ler('src/app/api/organizador/ligas/[id]/pagamento/route.ts')

assert.doesNotMatch(checkout, /pricing\.items\.map/)
assert.doesNotMatch(previa, /pricing\.items\.map/)
assert.doesNotMatch(resumo, /pricing\.items\.map/)
assert.match(checkout, /linhasDoCheckout/)
assert.match(checkout, /pagamentoHabilitado === false/)
assert.match(previa, /hrefDepoisDaConfiguracao\(ligaId, false\)/)
assert.match(previa, /Ir para criação de grupos/)
assert.doesNotMatch(previa, /Realizar pagamento[\s\S]*hrefDepoisDaConfiguracao\(ligaId, false\)/)
assert.match(estrutura, /estruturaExigePagamentoConfirmado/)
assert.match(estrutura, /liberarCampeonatoSemCobranca/)
assert.match(estrutura, /PAGAMENTO_PENDENTE/)
assert.match(pagamento, /pagamentoHabilitado\(\)/)
assert.match(ler('.env.example'), /PAGAMENTO_HABILITADO/)
assert.match(ler('src/lib/infinitepay.ts'), /createPaymentLink/)
assert.match(ler('src/app/api/webhooks/infinitepay/route.ts'), /infinitepay/)

console.log('pagamento desligado: configuracao segue para grupos, gate passa e o checkout nao quebra no map')
