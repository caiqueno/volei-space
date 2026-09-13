// Cupons de desconto do checkout de ativação — lista de TESTE, hardcoded.
// Não existe tabela/CRUD de cupons: quando esse fluxo deixar de ser uma
// simulação, isto deve virar uma tabela real com validade/uso único/etc.
const TEST_COUPONS: Record<string, number> = {
  TESTE10: 0.1,
  LUVA20: 0.2,
}

export interface ResolvedCoupon {
  code: string
  percent: number
}

export function resolveCoupon(code?: string | null): ResolvedCoupon | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  const percent = TEST_COUPONS[normalized]
  return percent ? { code: normalized, percent } : null
}
