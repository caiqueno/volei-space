'use client'

import { dateTimeLocalToIso, isoToDateTimeLocal } from '@/lib/date-brazil'

// Para datas que semanticamente precisam de hora (ex.: "inscrições fecham
// dia 20 às 23:59") — <input type="date"> perderia essa informação.
export function DateTimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (isoValue: string | null) => void
  disabled?: boolean
}) {
  return (
    <input
      type="datetime-local"
      value={isoToDateTimeLocal(value)}
      disabled={disabled}
      onChange={(event) => onChange(dateTimeLocalToIso(event.target.value))}
      className="creator-input rounded-2xl border px-4 py-3 font-bold disabled:opacity-50"
    />
  )
}
