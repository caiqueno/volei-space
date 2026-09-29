import { z } from 'zod'
import { ACTIVATION_PRICE_CENTS, MATCH_PRICE_CENTS, QR_CODE_PRICE_CENTS, SCORESHEET_SCOUTS_PRICE_CENTS, getVolumeDiscountPercent } from './constants'
import { estimateMatchCount } from './estimateMatchCount'
import { resolveCoupon } from './coupons'
import type { MatchEstimate, MatchEstimateInput } from './types'

export interface CategoryPricingInput {
  categoriaCampeonatoId: string
  config: MatchEstimateInput & { sumulaScoutsEnabled?: boolean | null; qrCodeEnabled?: boolean | null }
}

export interface CategoryPricingRow {
  categoriaCampeonatoId: string
  estimate: MatchEstimate
  matchUnitCents: number
  sumulaScoutsEnabled: boolean
  qrCodeEnabled: boolean
  managementCents: number | null
  scoresheetScoutsCents: number | null
  qrCodeCents: number | null
  subtotalCents: number | null
  volumeDiscountCents: number | null
  variableTotalCents: number | null
}

export interface CategoriesPricing {
  available: boolean
  categories: CategoryPricingRow[]
  matchCount: number | null
  subtotalCents: number | null
  discountPercent: number | null
  discountCents: number | null
  activationCents: number
  totalBeforeCouponCents: number | null
  coupon: { code: string; percent: number; discountCents: number } | null
  totalCents: number | null
}

/** One activation and volume tier per championship. No IO or mutation of inputs. */
export function calculateCategoriesPrice(inputs: readonly CategoryPricingInput[], couponCode?: string | null): CategoriesPricing {
  const ids = new Set<string>()
  const categories = inputs.map(({ categoriaCampeonatoId, config }): CategoryPricingRow => {
    if (!z.string().uuid().safeParse(categoriaCampeonatoId).success || ids.has(categoriaCampeonatoId)) {
      throw new Error('Categorias inválidas ou duplicadas na precificação.')
    }
    ids.add(categoriaCampeonatoId)
    const numericValid = [config.quantidadeEquipes, config.quantidadeGrupos].every(value => value == null || (Number.isSafeInteger(value) && value > 0)) && (config.quantidadeGrupos == null || config.quantidadeGrupos <= 32)
    const formatValid = ['PONTOS_CORRIDOS', 'GRUPOS_MATA_MATA', 'MATA_MATA', 'COPA_CURTA'].includes(config.formato ?? '')
    const phaseValid = config.faseEliminatoria == null || ['NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS'].includes(config.faseEliminatoria)
    const flagsValid = [config.turnoReturno, config.disputaTerceiroLugar, config.sumulaScoutsEnabled, config.qrCodeEnabled].every(value => value == null || typeof value === 'boolean')
    const estimate = numericValid && formatValid && phaseValid && flagsValid
      ? { ...estimateMatchCount(config) }
      : { disponivel: false, total: 0, faseDeGrupos: 0, eliminatorias: 0 }
    const sumulaScoutsEnabled = config.sumulaScoutsEnabled === true
    const qrCodeEnabled = config.qrCodeEnabled === true
    const matchUnitCents = MATCH_PRICE_CENTS + (sumulaScoutsEnabled ? SCORESHEET_SCOUTS_PRICE_CENTS : 0) + (qrCodeEnabled ? QR_CODE_PRICE_CENTS : 0)
    if (!Number.isSafeInteger(estimate.total * matchUnitCents)) estimate.disponivel = false
    return {
      categoriaCampeonatoId, estimate, matchUnitCents, sumulaScoutsEnabled, qrCodeEnabled,
      managementCents: estimate.disponivel ? estimate.total * MATCH_PRICE_CENTS : null,
      scoresheetScoutsCents: estimate.disponivel ? estimate.total * (sumulaScoutsEnabled ? SCORESHEET_SCOUTS_PRICE_CENTS : 0) : null,
      qrCodeCents: estimate.disponivel ? estimate.total * (qrCodeEnabled ? QR_CODE_PRICE_CENTS : 0) : null,
      subtotalCents: estimate.disponivel ? estimate.total * matchUnitCents : null,
      volumeDiscountCents: null, variableTotalCents: null,
    }
  })
  const unavailable: CategoriesPricing = {
    available: false, categories, matchCount: null, subtotalCents: null, discountPercent: null,
    discountCents: null, activationCents: ACTIVATION_PRICE_CENTS, totalBeforeCouponCents: null,
    coupon: null, totalCents: null,
  }
  if (categories.length === 0 || categories.some(row => !row.estimate.disponivel)) return unavailable
  const matchCount = categories.reduce((total, row) => total + row.estimate.total, 0)
  const subtotalCents = categories.reduce((total, row) => total + row.subtotalCents!, 0)
  if (!Number.isSafeInteger(subtotalCents + ACTIVATION_PRICE_CENTS) || !Number.isSafeInteger(matchCount)) return unavailable
  const discountPercent = getVolumeDiscountPercent(matchCount)
  const discountCents = Math.round(subtotalCents * discountPercent)
  // Largest remainders allocate the single rounded discount without changing its value.
  // BigInt avoids a lossy intermediate multiplication of two cent amounts.
  const allocations = categories.map(row => {
    const numerator = BigInt(row.subtotalCents!) * BigInt(discountCents)
    const denominator = BigInt(subtotalCents || 1)
    return { row, cents: Number(numerator / denominator), remainder: numerator % denominator }
  })
  let remainderCents = discountCents - allocations.reduce((sum, item) => sum + item.cents, 0)
  allocations.sort((a, b) => a.remainder === b.remainder ? a.row.categoriaCampeonatoId.localeCompare(b.row.categoriaCampeonatoId) : a.remainder > b.remainder ? -1 : 1)
  for (const allocation of allocations) {
    const extra = remainderCents > 0 ? 1 : 0
    remainderCents -= extra
    allocation.row.volumeDiscountCents = allocation.cents + extra
    allocation.row.variableTotalCents = allocation.row.subtotalCents! - allocation.row.volumeDiscountCents
  }
  const totalBeforeCouponCents = ACTIVATION_PRICE_CENTS + subtotalCents - discountCents
  const resolved = resolveCoupon(couponCode)
  // Preserve the simulated checkout: coupon applies after volume, INCLUDING activation.
  const coupon = resolved ? { ...resolved, discountCents: Math.round(totalBeforeCouponCents * resolved.percent) } : null
  return {
    available: true, categories, matchCount, subtotalCents, discountPercent, discountCents,
    activationCents: ACTIVATION_PRICE_CENTS, totalBeforeCouponCents, coupon,
    totalCents: totalBeforeCouponCents - (coupon?.discountCents ?? 0),
  }
}
