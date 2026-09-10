'use client'

import { formatCents } from '@/lib/pricing'
import type { ChampionshipPricing, MatchEstimate, PricingLineItem } from '@/lib/pricing'

// Usado só na Prévia — recebe o pricing/estimativa já calculados pelo
// SERVIDOR (GET .../setup/previa), que é o valor autoritativo. O wizard usa
// PricingSummary (client-side) para o preço "ao vivo" enquanto o organizador
// configura; aqui é a versão de conferência final.
export function PricingBreakdown({
  pricing,
  estimativaPartidas,
  partidasGeradas,
}: {
  pricing: ChampionshipPricing
  estimativaPartidas: MatchEstimate
  partidasGeradas: number
}) {
  return (
    <div className="creator-modal-section rounded-2xl border p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Investimento estimado</p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="font-display text-3xl font-black text-luva-amber">{formatCents(pricing.totalCents)}</strong>
        <p className="text-sm font-semibold text-slate-400">
          {estimativaPartidas.disponivel ? `para ${estimativaPartidas.total} partida(s) estimadas` : 'estimativa indisponível'}
        </p>
      </div>

      {partidasGeradas > 0 && (
        <p className="mt-1 text-xs font-semibold text-slate-500">{partidasGeradas} partida(s) já geradas de fato (a estimativa é sobre a configuração; o número real usa as equipes efetivamente aprovadas).</p>
      )}

      <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
        {pricing.items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-slate-300">
                {item.label}
                {item.unitCents != null && <span className="ml-1 text-slate-500">({formatCents(item.unitCents)}/partida)</span>}
              </p>
              {describeItemComposition(item, estimativaPartidas) && (
                <p className="text-xs text-slate-500">{describeItemComposition(item, estimativaPartidas)}</p>
              )}
            </div>
            <p className="shrink-0 font-bold text-white">{formatCents(item.totalCents)}</p>
          </div>
        ))}
        {pricing.discountCents > 0 && (
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-emerald-300">Desconto por volume ({Math.round(pricing.discountPercent * 100)}%)</p>
            <p className="font-bold text-emerald-300">-{formatCents(pricing.discountCents)}</p>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-base">
          <strong className="text-white">Total</strong>
          <strong className="text-luva-amber">{formatCents(pricing.totalCents)}</strong>
        </div>
      </div>
    </div>
  )
}

// Linha secundária de composição, abaixo de cada item — só quando o item de
// fato tem custo (não faz sentido detalhar "18 partidas" sob um recurso não
// contratado, que aparece com totalCents=0). Derivada 100% de
// estimativaPartidas (faseDeGrupos/eliminatorias, já calculados por
// estimateMatchCount) — nenhum número aqui é hardcoded.
function describeItemComposition(item: PricingLineItem, estimate: MatchEstimate): string | null {
  if (!estimate.disponivel || item.totalCents <= 0) return null

  if (item.key === 'gestao') {
    const { total, faseDeGrupos, eliminatorias } = estimate
    if (faseDeGrupos > 0 && eliminatorias > 0) return `${total} jogo(s) (${faseDeGrupos} fase de grupos + ${eliminatorias} fases finais)`
    if (faseDeGrupos > 0) return `${total} jogo(s) (fase de grupos)`
    if (eliminatorias > 0) return `${total} jogo(s) (fases finais)`
    return `${total} jogo(s)`
  }

  if (item.key === 'sumulaScouts' || item.key === 'qrCode') {
    return `${estimate.total} partida(s)`
  }

  return null
}
