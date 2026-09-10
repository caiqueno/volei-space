'use client'

// Substitui radio/checkbox múltiplo: o projeto não usa <input type="radio">
// em nenhum lugar. Padrão exato de src/app/painel/page.tsx (toggleCriterio...).
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  disabled,
}: {
  value: T | null | undefined
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
  columns?: 2 | 3
  disabled?: boolean
}) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`creator-category-option disabled:cursor-not-allowed disabled:opacity-50 ${value === option.value ? 'is-selected' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
