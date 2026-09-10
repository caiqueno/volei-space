// Valores em CENTAVOS inteiros. Trabalhar em reais com float acumula ruído
// (3.90 + 9.90 + 1.50 com desconto de 12% não fecha), então todo o cálculo
// acontece em inteiros e a formatação para R$ é feita só na borda da UI.

/** Ativação do campeonato: cobrada uma vez, nunca recebe desconto. */
export const ACTIVATION_PRICE_CENTS = 4900

/** Gestão básica, por partida. */
export const MATCH_PRICE_CENTS = 390

/** Súmula Digital + Scouts: UM único recurso comercial, por partida. */
export const SCORESHEET_SCOUTS_PRICE_CENTS = 990

/** Identificação por QR Code (nome + foto do atleta), por partida. */
export const QR_CODE_PRICE_CENTS = 150

/**
 * Desconto por volume, aplicado só sobre o subtotal variável (partidas).
 * Faixas fechadas: o percentual da faixa em que a quantidade cai.
 */
export const VOLUME_DISCOUNT_TIERS = [
  { min: 1, max: 20, percent: 0 },
  { min: 21, max: 40, percent: 0.05 },
  { min: 41, max: 80, percent: 0.08 },
  { min: 81, max: 150, percent: 0.12 },
  { min: 151, max: Number.POSITIVE_INFINITY, percent: 0.15 },
] as const

export function getVolumeDiscountPercent(matchCount: number): number {
  if (matchCount <= 0) return 0
  const tier = VOLUME_DISCOUNT_TIERS.find((item) => matchCount >= item.min && matchCount <= item.max)
  return tier?.percent ?? 0
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
