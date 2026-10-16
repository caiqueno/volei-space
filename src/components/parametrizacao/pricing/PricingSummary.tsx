'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { consultar } from '@/lib/api-cliente'
import { formatCents, linhasDoCheckout } from '@/lib/pricing'
import type { ChampionshipPricing, MatchEstimate } from '@/lib/pricing'

// Faixa compacta de preço "ao vivo" do wizard. Busca o mesmo endpoint
// autoritativo da Prévia (GET .../setup/previa, que tem acesso à Liga
// inteira) em vez de recalcular localmente com o recorte (DTO) estreito de
// cada seção — essa era a causa raiz de dois bugs reais: o preço sumia da
// Classificação (nunca foi ligado ali) e reiniciava em R$49 nas Inscrições
// (calculava com formato/sumulaScoutsEnabled ausentes, cujo fallback é só a
// taxa de ativação). Com uma única fonte de verdade, os dois ficam
// estruturalmente impossíveis de repetir.
//
// `refreshKey` é opcional — passe o `autosaveStatus` da própria seção pra
// que o preço seja rebuscado sempre que um autosave terminar (é assim que
// ele "acumula" corretamente conforme o organizador avança pelo wizard).
export function PricingSummary({ ligaId, refreshKey }: { ligaId: number; refreshKey?: unknown }) {
  const [expanded, setExpanded] = useState(false)
  const [pricing, setPricing] = useState<ChampionshipPricing | null>(null)
  const [estimate, setEstimate] = useState<MatchEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [oculto, setOculto] = useState(false)
  // Só a 1ª carga real mostra o skeleton "Calculando..." — refetches
  // disparados por `refreshKey` (autosave) atualizam o valor em segundo
  // plano, sem desmontar o card nem piscar loading a cada tecla digitada.
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!hasLoadedOnce.current) setLoading(true)
    consultar<{ data: { pricing: ChampionshipPricing; estimativaPartidas: MatchEstimate; pagamentoHabilitado?: boolean } }>(`/api/organizador/ligas/${ligaId}/setup/previa`, { forcar: hasLoadedOnce.current })
      .then((payload) => payload.data)
      .then((loaded) => {
        if (cancelled) return
        if (loaded.pagamentoHabilitado === false) {
          setOculto(true)
          setPricing(null)
          setEstimate(null)
          return
        }
        setOculto(false)
        setPricing(loaded.pricing)
        setEstimate(loaded.estimativaPartidas)
        hasLoadedOnce.current = true
      })
      .catch(() => {
        if (!cancelled && !hasLoadedOnce.current) {
          setPricing(null)
          setEstimate(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligaId, refreshKey])

  if (oculto || (loading && !hasLoadedOnce.current)) return null

  if (loading || !pricing || !estimate) {
    return (
      <div className="creator-modal-section mt-4 rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estimativa de investimento</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">{loading ? 'Calculando...' : 'Complete a Estrutura para estimar o valor'}</p>
      </div>
    )
  }

  return (
    <div className="creator-modal-section mt-4 rounded-2xl border p-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estimativa de investimento</p>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            {estimate.disponivel ? `${estimate.total} partida(s) previstas` : 'Complete a Estrutura para estimar o valor'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <strong className="font-display text-lg font-black text-luva-amber">{formatCents(pricing.totalCents)}</strong>
          {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
          {linhasDoCheckout(pricing).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <p className="font-semibold text-slate-300">{item.label}</p>
              <p className="font-bold text-white">{formatCents(item.totalCents)}</p>
            </div>
          ))}
          {pricing.discountCents > 0 && (
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-emerald-300">Desconto por volume ({Math.round(pricing.discountPercent * 100)}%)</p>
              <p className="font-bold text-emerald-300">-{formatCents(pricing.discountCents)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
