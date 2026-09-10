'use client'

import { ArrowLeft, ArrowRight, Send } from 'lucide-react'

// Mesmo padrão de botões Voltar/Continuar/Concluir do /cadastro, adaptado
// para os tokens de botão do shell public-dashboard (public-primary-action /
// public-secondary-action) já usados na Central.
export function WizardNavigation({
  onBack,
  backDisabled,
  onNext,
  isLastStep,
  saving,
}: {
  onBack: () => void
  backDisabled: boolean
  onNext: () => void
  isLastStep: boolean
  saving: boolean
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={saving}
        className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLastStep ? <Send size={16} /> : <ArrowRight size={16} />}
        {saving ? 'Salvando...' : isLastStep ? 'Salvar e concluir' : 'Continuar'}
      </button>
    </div>
  )
}
