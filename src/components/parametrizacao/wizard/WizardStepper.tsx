'use client'

import { Check } from 'lucide-react'

export interface WizardStepDef {
  key: string
  title: string
}

// Mesmo padrão de src/app/cadastro/page.tsx (único wizard multi-etapas real
// do projeto): <ol> de bolhas numeradas + label, sem depender de nenhuma
// biblioteca de stepper (não existe nenhuma no projeto).
export function WizardStepper({
  steps,
  currentIndex,
  visitedIndexes,
  onSelect,
}: {
  steps: WizardStepDef[]
  currentIndex: number
  visitedIndexes: Set<number>
  onSelect: (index: number) => void
}) {
  return (
    <>
      <ol className="hidden gap-3 sm:grid sm:grid-cols-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index === currentIndex
          const isDone = index < currentIndex || (visitedIndexes.has(index) && index !== currentIndex)
          const canJump = visitedIndexes.has(index) || index <= currentIndex

          return (
            <li key={step.key}>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => onSelect(index)}
                aria-current={isActive ? 'step' : undefined}
                className="flex w-full items-center gap-2 text-left text-xs font-black disabled:cursor-not-allowed"
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    isActive
                      ? 'border-luva-amber bg-luva-amber text-[#050914]'
                      : isDone
                        ? 'border-emerald-300 bg-emerald-400/15 text-emerald-200'
                        : 'border-white/15 bg-white/[0.05] text-white/55'
                  }`}
                >
                  {isDone ? <Check size={13} /> : index + 1}
                </div>
                {/* <div>, não <p>: dentro de main.luva-shell, <p> tem cor
                    forçada por uma regra global, o que apagaria a distinção
                    ativo/concluído/futuro. */}
                <div className={isActive ? 'text-white' : isDone ? 'text-emerald-300' : 'text-white/60'}>{step.title}</div>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Mobile: "Etapa 2 de 4" simples, sem o <ol> completo. */}
      <div className="sm:hidden">
        <strong className="block text-xs font-black uppercase tracking-[0.16em] text-luva-amber">
          Etapa {currentIndex + 1} de {steps.length}
        </strong>
        <p className="mt-1 font-display text-lg font-black text-white">{steps[currentIndex]?.title}</p>
      </div>
    </>
  )
}
