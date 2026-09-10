'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { CLASSIFICATION_CRITERIA_LABELS } from '@/lib/championship-setup-defaults'

// Ordenação de critérios de desempate. Drag and drop está fora de escopo —
// setas sobe/desce + aria-live cobrem acessibilidade de teclado/leitor de
// tela sem precisar de biblioteca nova.
export function OrderedCriteriaList({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const [announcement, setAnnouncement] = useState('')
  const available = Object.keys(CLASSIFICATION_CRITERIA_LABELS).filter((key) => !value.includes(key))

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setAnnouncement(`${CLASSIFICATION_CRITERIA_LABELS[next[target]] ?? next[target]} agora é o ${target + 1}º critério.`)
  }

  function remove(index: number) {
    const removed = value[index]
    onChange(value.filter((_, i) => i !== index))
    setAnnouncement(`${CLASSIFICATION_CRITERIA_LABELS[removed] ?? removed} removido dos critérios.`)
  }

  function add(key: string) {
    onChange([...value, key])
    setAnnouncement(`${CLASSIFICATION_CRITERIA_LABELS[key] ?? key} adicionado como ${value.length + 1}º critério.`)
  }

  return (
    <div className="grid gap-4">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <div className="creator-modal-section rounded-2xl border p-4">
        {value.length === 0 && (
          <p className="text-sm font-semibold text-slate-400">Nenhum critério selecionado — escolha ao menos um abaixo.</p>
        )}
        <ol className="grid gap-2">
          {value.map((key, index) => (
            <li key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-luva-amber bg-luva-amber text-[11px] font-black text-[#050914]">
                {index + 1}
              </div>
              <strong className="flex-1 text-sm font-bold text-white">{CLASSIFICATION_CRITERIA_LABELS[key] ?? key}</strong>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Mover ${CLASSIFICATION_CRITERIA_LABELS[key] ?? key} para cima`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-luva-amber/50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Mover ${CLASSIFICATION_CRITERIA_LABELS[key] ?? key} para baixo`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-luva-amber/50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label={`Remover ${CLASSIFICATION_CRITERIA_LABELS[key] ?? key}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-red-400/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ol>
        {value.length > 0 && (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            Ordenação: {value.map((key, i) => `${i + 1}º ${CLASSIFICATION_CRITERIA_LABELS[key] ?? key}`).join(' → ')}
          </p>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Adicionar critério</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((key) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => add(key)}
                className="creator-category-option disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CLASSIFICATION_CRITERIA_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
