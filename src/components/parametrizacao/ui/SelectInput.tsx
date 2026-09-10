'use client'

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T | null | undefined
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
  disabled?: boolean
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className="creator-input rounded-2xl border px-4 py-3 font-bold disabled:opacity-50"
    >
      {!value && <option value="" disabled>Selecione...</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
