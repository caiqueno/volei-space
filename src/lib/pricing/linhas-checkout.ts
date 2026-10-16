import type { PricingLineItem } from './types'

export interface LinhaCheckout {
  id: string
  key?: PricingLineItem['key']
  label: string
  totalCents: number
  unitCents?: number
}

type PrecoComItens = {
  items?: Array<Partial<PricingLineItem> | null> | null
  categories?: Array<{
    categoriaCampeonatoId?: string
    variableTotalCents?: number | null
    subtotalCents?: number | null
    estimate?: { total?: number | null } | null
  }> | null
  activationCents?: number | null
}

/**
 * O checkout antigo lia `pricing.items`. A cotação por categoria devolve
 * `pricing.categories`. Sem um dos dois, a lista fica vazia e o `.map` não quebra.
 */
export function linhasDoCheckout(pricing: PrecoComItens | null | undefined): LinhaCheckout[] {
  if (!pricing) return []
  if (Array.isArray(pricing.items)) {
    return pricing.items.flatMap((item, index) => {
      if (!item || typeof item.totalCents !== 'number') return []
      return [{
        id: item.key || `item-${index}`,
        key: item.key,
        label: item.label || 'Item',
        totalCents: item.totalCents,
        unitCents: item.unitCents,
      }]
    })
  }
  if (!Array.isArray(pricing.categories)) return []

  const linhas: LinhaCheckout[] = []
  if (typeof pricing.activationCents === 'number') {
    linhas.push({ id: 'ativacao', key: 'ativacao', label: 'Ativação do campeonato', totalCents: pricing.activationCents })
  }
  pricing.categories.forEach((categoria, index) => {
    const total = categoria?.variableTotalCents ?? categoria?.subtotalCents
    if (typeof total !== 'number') return
    const jogos = categoria.estimate?.total
    linhas.push({
      id: categoria.categoriaCampeonatoId || `categoria-${index}`,
      key: 'gestao',
      label: typeof jogos === 'number' ? `Categoria (${jogos} partida(s))` : `Categoria ${index + 1}`,
      totalCents: total,
    })
  })
  return linhas
}
