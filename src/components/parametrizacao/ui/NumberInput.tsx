'use client'

// Wrapper de <input type="number"> que trabalha com number|null em vez do
// string cru do DOM — os schemas Zod de setup usam `z.number().int()...`,
// então o wizard nunca deveria enviar string para esses campos.
export function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
}: {
  value: number | null | undefined
  onChange: (value: number | null) => void
  min?: number
  max?: number
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value
        onChange(raw === '' ? null : Number(raw))
      }}
      className="creator-input rounded-2xl border px-4 py-3 font-bold disabled:opacity-50"
    />
  )
}
