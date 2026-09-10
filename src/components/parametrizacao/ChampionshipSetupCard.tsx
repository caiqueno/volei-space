'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Clock, AlertTriangle, Lock, type LucideIcon } from 'lucide-react'
import type { ChampionshipSetupCardDTO, ChampionshipSetupStatus } from '@/types/championship-setup'

const STATUS_META: Record<ChampionshipSetupStatus, { icon: LucideIcon; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: 'Concluído', className: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10' },
  'in-progress': { icon: Clock, label: 'Em andamento', className: 'text-sky-300 border-sky-400/40 bg-sky-400/10' },
  'not-started': { icon: Circle, label: 'Não iniciado', className: 'text-slate-400 border-slate-500/35 bg-slate-400/8' },
  'attention-required': { icon: AlertTriangle, label: 'Requer atenção', className: 'text-amber-300 border-amber-400/45 bg-amber-400/10' },
  blocked: { icon: Lock, label: 'Bloqueado', className: 'text-slate-500 border-slate-600/35 bg-slate-600/10' },
}

export function ChampionshipSetupCard({ card }: { card: ChampionshipSetupCardDTO }) {
  const meta = STATUS_META[card.status] ?? STATUS_META['not-started']
  const Icon = meta.icon
  const blocked = card.status === 'blocked'

  const content = (
    <div
      className={`luva-card flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition ${blocked ? 'opacity-60' : 'cursor-pointer hover:border-luva-amber/40'}`}
    >
      <div className="flex items-center gap-4">
        {/* <div>, não <span>: dentro de main.luva-shell, texto/ícone colorido
            em <span> é neutralizado por uma regra global mais específica
            (html body main.luva-shell span:not(...)) — <div> escapa dela. */}
        <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${meta.className}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="font-display text-base font-black text-white">{card.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-300">{card.summary ?? meta.label}</p>
        </div>
      </div>
      <div className={`hidden shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] sm:inline-flex ${meta.className}`}>
        {meta.label}
      </div>
    </div>
  )

  if (blocked) {
    return (
      <div aria-disabled="true" title="Conclua as sessões anteriores para desbloquear">
        {content}
      </div>
    )
  }

  return (
    <Link href={card.href} className="block">
      {content}
    </Link>
  )
}
