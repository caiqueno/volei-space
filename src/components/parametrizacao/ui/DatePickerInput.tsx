'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays } from 'lucide-react'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { FloatingLabelInput } from '@/components/ui/floating-label'
import { dateInputToIsoEnd, dateInputToIsoStart, isoToDateInput, formatDateBr } from '@/lib/date-brazil'

interface DatePickerInputProps {
  id: string
  label: string
  value: string | null | undefined
  onChange: (isoValue: string | null) => void
  /** Mesma convenção de DateInput.tsx — substituto direto dele. */
  edge: 'start' | 'end'
  required?: boolean
  disabled?: boolean
  invalid?: boolean
}

// Combina input de texto (dd/mm/aaaa, editável manualmente) + ícone +
// calendário visual num popover — não existe Radix Popover neste projeto,
// então é um dropdown próprio (fecha em clique-fora ou Escape).
//
// O painel é renderizado via portal em document.body, com `position: fixed`
// calculado a partir do próprio input — necessário porque o wizard envolve
// cada seção num `.luva-card` (globals.css) com `overflow: hidden` (usado
// pelo efeito de brilho do próprio card), que cortaria qualquer popup
// posicionado normalmente dentro da árvore do DOM.
export function DatePickerInput({ id, label, value, onChange, edge, required, disabled, invalid }: DatePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => (value ? formatDateBr(value) : ''))
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toIso = edge === 'start' ? dateInputToIsoStart : dateInputToIsoEnd

  useEffect(() => {
    setText(value ? formatDateBr(value) : '')
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

  const dateInputValue = isoToDateInput(value)
  const selectedDate = dateInputValue ? new Date(`${dateInputValue}T00:00:00`) : undefined

  function commitTypedText() {
    const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      const [, dd, mm, yyyy] = match
      onChange(toIso(`${yyyy}-${mm}-${dd}`))
    } else if (text.trim() === '') {
      onChange(null)
    } else {
      setText(value ? formatDateBr(value) : '')
    }
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
        className={invalid ? 'field-missing-control pr-11' : 'pr-11'}
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
            className="creator-modal-section fixed z-50 rounded-2xl border p-3"
            style={{ top: panelStyle.top, left: panelStyle.left }}
          >
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) return
                const yyyy = date.getFullYear()
                const mm = String(date.getMonth() + 1).padStart(2, '0')
                const dd = String(date.getDate()).padStart(2, '0')
                onChange(toIso(`${yyyy}-${mm}-${dd}`))
                setOpen(false)
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
