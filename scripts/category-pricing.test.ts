import assert from 'node:assert/strict'
import { calculateCategoriesPrice } from '../src/lib/pricing/calculateCategoriesPrice'
import { calculateChampionshipPrice } from '../src/lib/pricing/calculateChampionshipPrice'

const config = { formato: 'PONTOS_CORRIDOS', quantidadeEquipes: 6, quantidadeGrupos: 1, faseEliminatoria: 'NENHUMA' }
const input = [{ categoriaCampeonatoId: '00000000-0000-4000-8000-000000000001', config }, { categoriaCampeonatoId: '00000000-0000-4000-8000-000000000002', config: { ...config, sumulaScoutsEnabled: true, qrCodeEnabled: true } }]
const before = JSON.stringify(input)
const result = calculateCategoriesPrice(input)
assert.equal(result.available, true)
assert.equal(result.matchCount, 30)
assert.equal(result.activationCents, 4900)
assert.equal(result.subtotalCents, 15 * 390 + 15 * 1530)
assert.equal(result.discountPercent, 0.05, 'volume is the championship total, not each category')
assert.equal(result.discountCents, Math.round(result.subtotalCents! * 0.05))
assert.equal(result.totalCents, 4900 + result.subtotalCents! - result.discountCents!)
assert.equal(result.categories.reduce((sum, row) => sum + row.volumeDiscountCents!, 0), result.discountCents)
assert.equal(JSON.stringify(input), before, 'inputs unchanged')

const single = calculateCategoriesPrice([input[0]])
assert.equal(single.totalCents, calculateChampionshipPrice({ matchCount: 15 }).totalCents, 'single category retains existing price')
const coupon = calculateCategoriesPrice(input, ' teste10 ')
assert.equal(coupon.coupon?.discountCents, Math.round(result.totalCents! * 0.1))
assert.equal(coupon.totalCents, result.totalCents! - coupon.coupon!.discountCents, 'coupon includes activation after volume')
assert.equal(calculateCategoriesPrice(input, 'invalid').coupon, null)
assert.equal(calculateCategoriesPrice([{ categoriaCampeonatoId: '00000000-0000-4000-8000-000000000001', config: {} }]).totalCents, null)
assert.equal(calculateCategoriesPrice([...input, { categoriaCampeonatoId: '00000000-0000-4000-8000-000000000003', config: {} }]).totalCents, null, 'partial estimate cannot quote a final price')
assert.equal(calculateCategoriesPrice([]).available, false)
assert.throws(() => calculateCategoriesPrice([input[0], input[0]]), /duplicadas/)
assert.equal(calculateCategoriesPrice([{ categoriaCampeonatoId: '00000000-0000-4000-8000-000000000001', config: { ...config, quantidadeEquipes: NaN } }]).available, false)

// Three seven-team groups give 63 games and require an odd-cent global discount.
const fractional = [3, 1, 2].map(categoriaCampeonatoId => ({ categoriaCampeonatoId: '00000000-0000-4000-8000-' + String(categoriaCampeonatoId).padStart(12, '0'), config: { ...config, quantidadeEquipes: 7 } }))
const price = calculateCategoriesPrice(fractional)
const reversed = calculateCategoriesPrice([...fractional].reverse())
assert.equal(price.discountCents, Math.round(63 * 390 * 0.08))
assert.equal(price.categories.reduce((sum, row) => sum + row.volumeDiscountCents!, 0), price.discountCents)
for (const row of price.categories) assert.equal(row.volumeDiscountCents, reversed.categories.find(other => row.categoriaCampeonatoId === other.categoriaCampeonatoId)!.volumeDiscountCents, 'allocation stable by category identity')
assert.equal(price.categories.reduce((sum, row) => sum + row.variableTotalCents!, 0) + 4900, price.totalCents)
console.log('category-pricing: OK')
