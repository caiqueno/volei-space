'use client'

import type { LucideIcon } from 'lucide-react'

// Substitui o switch iOS, que não existe no projeto: escolha binária rica em
// 2 cartões (padrão `creator-registration-toggle`, já usado no modal de
// /painel para tie-break/turno-returno).
export function ToggleCards({
  value,
  onChange,
  trueOption,
  falseOption,
  disabled,
}: {
  value: boolean
  onChange: (value: boolean) => void
  trueOption: { icon: LucideIcon; title: string; description: string }
  falseOption: { icon: LucideIcon; title: string; description: string }
  disabled?: boolean
}) {
  const TrueIcon = trueOption.icon
  const FalseIcon = falseOption.icon

  return (
    <div className="creator-registration-toggle">
      <button type="button" disabled={disabled} onClick={() => onChange(true)} className={value ? 'is-selected' : ''}>
        <div className="creator-registration-icon">
          <TrueIcon size={18} />
        </div>
        <strong>{trueOption.title}</strong>
        <span>{trueOption.description}</span>
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(false)} className={!value ? 'is-selected' : ''}>
        <div className="creator-registration-icon">
          <FalseIcon size={18} />
        </div>
        <strong>{falseOption.title}</strong>
        <span>{falseOption.description}</span>
      </button>
    </div>
  )
}
