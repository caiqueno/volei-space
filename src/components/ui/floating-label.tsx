'use client'

import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface FloatingLabelInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder'> {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

// Input com rótulo flutuante — padrão adotado para campos de texto/número
// simples do wizard de parametrização. Não há shadcn/Radix/cn() neste
// projeto: usa <input> nativo + utilitário `peer` puro do Tailwind,
// reaproveitando a mesma classe visual `creator-input` já usada por
// TextInput/NumberInput (que só define cor/fundo/borda via CSS, nunca
// padding — por isso dá pra ajustar o padding aqui sem conflito).
export function FloatingLabelInput({ label, value, onChange, id, required, className, ...rest }: FloatingLabelInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="relative">
      <input
        {...rest}
        id={inputId}
        value={value}
        placeholder=" "
        onChange={(event) => onChange(event.target.value)}
        className={['creator-input peer w-full rounded-2xl border px-4 pb-2.5 pt-6 font-bold', className].filter(Boolean).join(' ')}
      />
      <label
        htmlFor={inputId}
        className="pointer-events-none absolute left-4 top-2 text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.1em]"
      >
        {label}
        {required && <span className="text-luva-amber"> *</span>}
      </label>
    </div>
  )
}

interface FloatingLabelNumberInputProps {
  id?: string
  label: string
  value: number | null | undefined
  onChange: (value: number | null) => void
  min?: number
  max?: number
  required?: boolean
  disabled?: boolean
  className?: string
}

// Variante numérica — mesmo parsing de NumberInput.tsx (string|'' -> number|null).
export function FloatingLabelNumberInput({ value, onChange, min, max, disabled, ...rest }: FloatingLabelNumberInputProps) {
  return (
    <FloatingLabelInput
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      value={value == null ? '' : String(value)}
      onChange={(raw) => onChange(raw === '' ? null : Number(raw))}
    />
  )
}
