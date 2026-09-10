'use client'

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

const VARIANTS = {
  error: { icon: AlertTriangle, classes: 'border-red-400/30 bg-red-500/10 text-red-100' },
  success: { icon: CheckCircle2, classes: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' },
  info: { icon: Info, classes: 'border-sky-400/30 bg-sky-500/10 text-sky-100' },
} as const

// IMPORTANTE: rounded-xl, não rounded-2xl/rounded-3xl. Dentro de
// main.luva-shell, `.rounded-2xl.border` é forçado para painel escuro com
// borda âmbar (!important) por uma regra global — um alerta vermelho ou
// verde com rounded-2xl fica visualmente idêntico a um card neutro.
// rounded-xl fica fora do seletor da regra.
export function FormAlert({ variant, children }: { variant: keyof typeof VARIANTS; children: ReactNode }) {
  const { icon: Icon, classes } = VARIANTS[variant]
  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm font-bold ${classes}`}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      <div>{children}</div>
    </div>
  )
}
