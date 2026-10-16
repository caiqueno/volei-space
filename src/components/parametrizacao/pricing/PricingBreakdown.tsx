'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { hrefDepoisDaConfiguracao } from '@/lib/pagamento-navegacao'
import { formatCents, linhasDoCheckout } from '@/lib/pricing'
import type { ChampionshipPricing, MatchEstimate, PricingLineItem } from '@/lib/pricing'
import { FloatingLabelInput } from '@/components/ui/floating-label'

// Usado só na Prévia — recebe o pricing/estimativa já calculados pelo
// SERVIDOR (GET .../setup/previa), que é o valor autoritativo. O wizard usa
// PricingSummary (client-side) para o preço "ao vivo" enquanto o organizador
// configura; aqui é a versão de conferência final.
export function PricingBreakdown({
  pricing,
  estimativaPartidas,
  partidasGeradas,
  ligaId,
  isValid,
  alreadyPaid,
  pagamentoHabilitado,
}: {
  pricing: ChampionshipPricing
  estimativaPartidas: MatchEstimate
  partidasGeradas: number
  ligaId: number
  isValid: boolean
  alreadyPaid: boolean
  pagamentoHabilitado: boolean
}) {
  const router = useRouter()
  const [cupom, setCupom] = useState('')
  if (!pagamentoHabilitado) {
    return (
      <div className="creator-modal-section rounded-2xl border p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Próximo passo</p>
        <p className="mt-3 text-sm font-semibold text-slate-300">A configuração segue sem cobrança. Os grupos ficam liberados.</p>
        <Link
          href={hrefDepoisDaConfiguracao(ligaId, false)}
          className="public-primary-action mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black"
        >
          Ir para criação de grupos
        </Link>
      </div>
    )
  }
  const linhas = linhasDoCheckout(pricing)
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
        {linhas.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
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

      <div className="mt-5 border-t border-white/10 pt-5">
        {alreadyPaid ? (
          <>
            <p className="text-sm font-black text-emerald-300">Pagamento confirmado</p>
            <Link
              href={`/painel/estrutura?ligaId=${ligaId}`}
              className="public-primary-action mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black"
            >
              Ir para criação de grupos
            </Link>
          </>
        ) : (
          <>
            <FloatingLabelInput label="Cupom de desconto (opcional)" value={cupom} onChange={setCupom} />
            <button
              type="button"
              disabled={!isValid}
              onClick={() => router.push(hrefDepoisDaConfiguracao(ligaId, true, cupom))}
              className="public-primary-action mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Realizar pagamento
            </button>
            {!isValid && (
              <p className="mt-2 text-xs font-semibold text-slate-500">Resolva as pendências acima antes de prosseguir para o pagamento.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Linha secundária de composição, abaixo de cada item — só quando o item de
// fato tem custo (não faz sentido detalhar "18 partidas" sob um recurso não
// contratado, que aparece com totalCents=0). Derivada 100% de
// estimativaPartidas (faseDeGrupos/eliminatorias, já calculados por
// estimateMatchCount) — nenhum número aqui é hardcoded.
function describeItemComposition(item: { key?: PricingLineItem['key']; totalCents: number }, estimate: MatchEstimate): string | null {
  if (!item.key || !estimate.disponivel || item.totalCents <= 0) return null

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
