type Props = {
  variant: 'ouro' | 'prata' | 'success' | 'warning' | 'error' | 'neutral' | 'info'
  children: React.ReactNode
}

const variants = {
  ouro: 'border-amber-400/55 bg-amber-400/12 text-amber-200',
  prata: 'border-slate-400/40 bg-slate-400/10 text-slate-200',
  success: 'border-emerald-400/45 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/45 bg-amber-400/10 text-amber-200',
  error: 'border-red-400/45 bg-red-400/10 text-red-200',
  neutral: 'border-slate-500/35 bg-slate-400/8 text-slate-300',
  info: 'border-sky-400/45 bg-sky-400/10 text-sky-200',
}

export function Badge({ variant, children }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${variants[variant]}`}>
      {children}
    </span>
  )
}
