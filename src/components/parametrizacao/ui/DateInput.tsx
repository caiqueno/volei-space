'use client'

import { dateInputToIsoEnd, dateInputToIsoStart, isoToDateInput } from '@/lib/date-brazil'

// Ponte entre <input type="date"> (YYYY-MM-DD local) e o ISO 8601 completo
// que os schemas de setup exigem. `edge` decide se um dia "puro" vira início
// (00:00) ou fim (23:59:59) do dia em horário de Brasília — importante para
// Liga_datas_check (dataInicio <= dataFim) não falhar por um dia que deveria
// ser igual em ambas as pontas.
export function DateInput({
  value,
  onChange,
  edge,
  disabled,
}: {
  value: string | null | undefined
  onChange: (isoValue: string | null) => void
  edge: 'start' | 'end'
  disabled?: boolean
}) {
  const toIso = edge === 'start' ? dateInputToIsoStart : dateInputToIsoEnd

  return (
    <input
      type="date"
      value={isoToDateInput(value)}
      disabled={disabled}
      onChange={(event) => onChange(toIso(event.target.value))}
      className="creator-input rounded-2xl border px-4 py-3 font-bold disabled:opacity-50"
    />
  )
}
