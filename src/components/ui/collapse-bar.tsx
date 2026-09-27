'use client'

import { useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

type Props = {
  title: string
  detail?: string
  children: ReactNode
}

export function CollapseBar({ title, detail, children }: Props) {
  const [open, setOpen] = useState(false)
  const label = detail ? `${title}. ${detail}` : title

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? `Recolher ${label}` : `Expandir ${label}`}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-luva-amber/60"
      >
        <span className="min-w-0">
          <span className="block font-display text-2xl font-black text-white">{title}</span>
          {detail && <span className="mt-1 block text-sm font-semibold text-slate-200">{detail}</span>}
        </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-luva-amber text-slate-950">
          {open ? <Minus size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}
        </span>
      </button>

      {open && <div className="mt-5">{children}</div>}
    </section>
  )
}
