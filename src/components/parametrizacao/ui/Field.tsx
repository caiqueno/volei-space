'use client'

import type { ReactNode } from 'react'

// Padrão de campo com rótulo do projeto (mesmo usado no modal de /painel):
// <label className="grid gap-2"><span className="...">Rótulo</span>{campo}</label>
export function Field({
  label,
  required,
  hint,
  invalid,
  children,
  className = '',
}: {
  label: string
  required?: boolean
  hint?: string
  invalid?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`grid gap-2 ${invalid ? 'field-missing' : ''} ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">
        {label}
        {required && <span className="text-luva-amber"> *</span>}
      </span>
      {children}
      {hint && <p className="text-xs font-semibold leading-5 text-slate-400">{hint}</p>}
    </label>
  )
}
