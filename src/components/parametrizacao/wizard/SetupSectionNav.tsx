'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Circle, Clock, Lock, type LucideIcon } from 'lucide-react'
import type { ChampionshipSetupOverviewDTO } from '@/types/championship-setup'
import type { ChampionshipSetupStatus } from '@/types/championship-setup'

const STATUS_ICON: Record<ChampionshipSetupStatus, { icon: LucideIcon; className: string }> = {
  completed: { icon: CheckCircle2, className: 'text-emerald-300' },
  'in-progress': { icon: Clock, className: 'text-sky-300' },
  'not-started': { icon: Circle, className: 'text-slate-400' },
  'attention-required': { icon: AlertTriangle, className: 'text-amber-300' },
  blocked: { icon: Lock, className: 'text-slate-500' },
}

// Trilho compacto das 7 seções — versão reduzida do Card Status List da
// Central, para o organizador não perder a visão geral enquanto está dentro
// de um wizard. `activeSection` também é revalidado no fetch: se outra
// seção mudou de status enquanto o organizador editava esta, ele já vê aqui.
export function SetupSectionNav({ ligaId, activeSection }: { ligaId: number; activeSection: string }) {
  const [overview, setOverview] = useState<ChampionshipSetupOverviewDTO | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/organizador/ligas/${ligaId}/setup`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) setOverview(payload.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ligaId, activeSection])

  return (
    <nav className="lg:sticky lg:top-6">
      <Link href="/painel" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-white">
        Voltar ao painel
      </Link>

      {overview && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <p>{overview.progress.completedSections} de {overview.progress.totalSections}</p>
            <strong className="text-luva-amber">{overview.progress.percent}%</strong>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-luva-amber transition-all duration-500" style={{ width: `${overview.progress.percent}%` }} />
          </div>
        </div>
      )}

      <ol className="grid gap-1">
        {overview?.cards.map((card) => {
          const meta = STATUS_ICON[card.status] ?? STATUS_ICON['not-started']
          const Icon = meta.icon
          const isActive = card.key === activeSection

          return (
            <li key={card.key}>
              <Link
                href={card.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`shrink-0 ${meta.className}`}>
                  <Icon size={16} />
                </div>
                {card.title}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
