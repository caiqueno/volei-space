'use client'

import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { AutosaveStatus } from './useSectionWizard'

// Feedback discreto — nunca toast. Toast fica reservado para erro real de
// conclusão de etapa (isso é decidido em WizardNavigation, não aqui).
export function WizardAutosaveStatus({ status, errorMessage }: { status: AutosaveStatus; errorMessage?: string | null }) {
  if (status === 'idle') return null

  if (status === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Salvando...
      </p>
    )
  }

  if (status === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
        <AlertCircle size={13} /> {errorMessage || 'Erro ao salvar'}
      </p>
    )
  }

  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
      <Check size={13} /> Salvo
    </p>
  )
}
