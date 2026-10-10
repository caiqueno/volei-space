'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Trophy } from 'lucide-react'
import { formatDateBr } from '@/lib/date-brazil'
import { formatCategoriaLabel } from '@/lib/equipe-categoria'
import type { LigaCarouselItem } from './types'
import mi from '@/styles/microinteracoes.module.css'

const MAX_VISIBLE_BADGES = 3

export function ChampionshipCard({ liga }: { liga: LigaCarouselItem }) {
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)

  const categorias = liga.categoriasReais ?? []
  const visiveis = categorias.slice(0, MAX_VISIBLE_BADGES)
  const restantes = categorias.slice(MAX_VISIBLE_BADGES)

  function goToCategoria(categoria: string, serie: string | null, event: React.MouseEvent) {
    // Badge não pode navegar para a visão geral do card pai — nem deixar o
    // Link ancestral também disparar (item 28).
    event.preventDefault()
    event.stopPropagation()
    const params = new URLSearchParams({ ligaId: String(liga.id), categoria })
    if (serie) params.set('serie', serie)
    router.push(`/classificacao?${params.toString()}`)
  }

  return (
    <Link
      href={`/painel/parametrizacao?ligaId=${liga.id}`}
      className={`group flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#071426] hover:border-luva-amber/40 ${mi.entrar} ${mi.cartao}`}
    >
      <div className="relative h-[33%] min-h-[110px] w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#0b1c33] to-[#050914]">
        {liga.capaUrl ? (
          <img src={liga.capaUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/15">
            <Trophy size={40} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#071426] to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {liga.logoUrl ? (
              <img src={liga.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Trophy size={18} className="text-luva-amber" />
            )}
          </span>
          <p className="min-w-0 flex-1 truncate font-display text-lg font-black text-[#ffffff]">{liga.nome}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} className="text-slate-400" />
            {formatDateBr(liga.dataInicio)} → {formatDateBr(liga.dataFim)}
          </span>
          {liga.localPrincipal && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={14} className="shrink-0 text-slate-400" />
              <span className="truncate">{liga.localPrincipal.nome}</span>
            </span>
          )}
        </div>

        {categorias.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {visiveis.map((item) => (
              <button
                key={`${item.categoria}-${item.serie}`}
                type="button"
                onClick={(event) => goToCategoria(item.categoria, item.serie, event)}
                className="rounded-full bg-luva-amber px-3 py-1 text-[11px] font-black text-[#050914] transition hover:bg-amber-300"
              >
                {formatCategoriaLabel(item.categoria, item.serie)}
              </button>
            ))}
            {restantes.length > 0 && (
              <span className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setShowMore((current) => !current)
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-black text-white/80 transition hover:border-luva-amber/60 hover:text-white"
                >
                  +{restantes.length}
                </button>
                {showMore && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="absolute bottom-full left-0 z-20 mb-2 grid gap-1 rounded-xl border border-white/12 bg-[#0b1c33] p-2 shadow-2xl shadow-slate-950/50"
                  >
                    {restantes.map((item) => (
                      <button
                        key={`${item.categoria}-${item.serie}`}
                        type="button"
                        onClick={(event) => goToCategoria(item.categoria, item.serie, event)}
                        className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[11px] font-black text-white/85 transition hover:bg-luva-amber hover:text-[#050914]"
                      >
                        {formatCategoriaLabel(item.categoria, item.serie)}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
