import {
  ACTIVATION_PRICE_CENTS,
  MATCH_PRICE_CENTS,
  QR_CODE_PRICE_CENTS,
  SCORESHEET_SCOUTS_PRICE_CENTS,
  getVolumeDiscountPercent,
} from './constants'
import type { ChampionshipPricing, ChampionshipPricingInput, PricingLineItem } from './types'

/**
 * valor_partida = gestão básica + (súmula+scouts) + (qr code)
 * subtotal      = partidas × valor_partida
 * desconto      = subtotal × percentual de volume
 * total         = ativação + subtotal - desconto
 *
 * A ativação nunca recebe desconto.
 */
export function calculateChampionshipPrice(input: ChampionshipPricingInput): ChampionshipPricing {
  const matchCount = Math.max(0, Math.floor(Number(input.matchCount ?? 0)))
  const sumulaScouts = Boolean(input.sumulaScoutsEnabled)
  const qrCode = Boolean(input.qrCodeEnabled)

  const matchUnitCents =
    MATCH_PRICE_CENTS +
    (sumulaScouts ? SCORESHEET_SCOUTS_PRICE_CENTS : 0) +
    (qrCode ? QR_CODE_PRICE_CENTS : 0)

  const items: PricingLineItem[] = [
    { key: 'ativacao', label: 'Ativação do campeonato', totalCents: ACTIVATION_PRICE_CENTS },
    { key: 'gestao', label: 'Gestão básica', unitCents: MATCH_PRICE_CENTS, totalCents: MATCH_PRICE_CENTS * matchCount },
    {
      key: 'sumulaScouts',
      label: 'Súmula Digital + Scouts',
      unitCents: SCORESHEET_SCOUTS_PRICE_CENTS,
      totalCents: sumulaScouts ? SCORESHEET_SCOUTS_PRICE_CENTS * matchCount : 0,
    },
    {
      key: 'qrCode',
      label: 'Identificação por QR Code',
      unitCents: QR_CODE_PRICE_CENTS,
      totalCents: qrCode ? QR_CODE_PRICE_CENTS * matchCount : 0,
    },
  ]

  const subtotalCents = matchUnitCents * matchCount
  const discountPercent = getVolumeDiscountPercent(matchCount)
  const discountCents = Math.round(subtotalCents * discountPercent)

  return {
    matchCount,
    matchUnitCents,
    items,
    subtotalCents,
    discountPercent,
    discountCents,
    activationCents: ACTIVATION_PRICE_CENTS,
    totalCents: ACTIVATION_PRICE_CENTS + subtotalCents - discountCents,
  }
}
