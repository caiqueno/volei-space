// Pricing Engine do campeonato.
//
// Módulo PURO (sem IO): roda no cliente para o preço reagir ao vivo enquanto
// o organizador configura, e no servidor para compor a resposta da Prévia.
//
// REGRA: o valor calculado no cliente é apresentação. A fonte de verdade é
// sempre o cálculo do servidor (GET .../setup/previa). Se um dia existir
// checkout, ele DEVE recalcular no servidor e nunca aceitar um total vindo
// do cliente.
//
// Nunca importe `@/lib/supabase-admin` (ou qualquer módulo com efeito
// colateral) aqui — `scripts/pricing.test.ts` executa este módulo sem env.

export * from './constants'
export * from './types'
export { estimateMatchCount } from './estimateMatchCount'
export { calculateChampionshipPrice } from './calculateChampionshipPrice'
export { resolveCoupon, type ResolvedCoupon } from './coupons'
