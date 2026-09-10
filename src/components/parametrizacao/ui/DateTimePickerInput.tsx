'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays } from 'lucide-react'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { FloatingLabelInput } from '@/components/ui/floating-label'
import { dateTimeLocalToIso, isoToDateTimeLocal } from '@/lib/date-brazil'

interface DateTimePickerInputProps {
  id: string
  label: string
  value: string | null | undefined
  onChange: (isoValue: string | null) => void
  required?: boolean
  disabled?: boolean
}

// Mesmo padrão de DatePickerInput.tsx (popover em portal, aberto/fechado por
// clique-fora/Escape) — aqui com um campo de horário dentro do mesmo painel,
// para as duas datas de inscrição (que são datetime, não só date). A
// conversão de/para ISO continua usando exatamente `dateTimeLocalToIso`/
// `isoToDateTimeLocal` de date-brazil.ts — as mesmas funções que
// DateTimeInput.tsx já usava; só o input visual muda, a lógica de datas não.
export function DateTimePickerInput({ id, label, value, onChange, required, disabled }: DateTimePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => formatDateTimeBr(value))
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(formatDateTimeBr(value))
  }, [value])

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPanelStyle({ top: rect.bottom + 8, left: rect.left })
    }
    updatePosition()

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const localValue = isoToDateTimeLocal(value)
  const [datePart, timePart] = localValue ? localValue.split('T') : ['', '']
  const selectedDate = datePart ? new Date(`${datePart}T00:00:00`) : undefined

  function commitTypedText() {
    const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
    if (match) {
      const [, dd, mm, yyyy, hh, min] = match
      onChange(dateTimeLocalToIso(`${yyyy}-${mm}-${dd}T${hh}:${min}`))
    } else if (text.trim() === '') {
      onChange(null)
    } else {
      setText(formatDateTimeBr(value))
    }
  }

  function selectDate(date: Date | undefined) {
    if (!date) return
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    onChange(dateTimeLocalToIso(`${yyyy}-${mm}-${dd}T${timePart || '00:00'}`))
  }

  function selectTime(nextTime: string) {
    if (!datePart) return
    onChange(dateTimeLocalToIso(`${datePart}T${nextTime || '00:00'}`))
  }

  return (
    <div className="relative" ref={anchorRef}>
      <FloatingLabelInput
        id={id}
        label={label}
        required={required}
        disabled={disabled}
        value={text}
        onChange={setText}
        onFocus={() => setOpen(true)}
        onBlur={commitTypedText}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-luva-amber disabled:pointer-events-none disabled:opacity-40"
        aria-label="Abrir calendário"
      >
        <CalendarDays size={18} />
      </button>

      {open &&
        !disabled &&
        panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            className="creator-modal-section fixed z-50 grid gap-3 rounded-2xl border p-3"
            style={{ top: panelStyle.top, left: panelStyle.left }}
          >
            <Calendar mode="single" locale={ptBR} selected={selectedDate} onSelect={selectDate} />
            <div className="border-t border-white/10 pt-3">
              <label htmlFor={`${id}-hora`} className="mb-1.5 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Horário
              </label>
              <input
                id={`${id}-hora`}
                type="time"
                value={timePart}
                disabled={!datePart}
                onChange={(event) => selectTime(event.target.value)}
                className="creator-input w-full rounded-xl border px-3 py-2 font-bold text-[#ffffff] disabled:opacity-40"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function formatDateTimeBr(value: string | null | undefined): string {
  const local = isoToDateTimeLocal(value)
  if (!local) return ''
  const [datePart, timePart] = local.split('T')
  const [yyyy, mm, dd] = datePart.split('-')
  return `${dd}/${mm}/${yyyy} ${timePart}`
}
