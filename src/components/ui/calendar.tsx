'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import type { ComponentProps } from 'react'

export type CalendarProps = ComponentProps<typeof DayPicker>

// Adaptação do calendário de referência (shadcn) para os tokens reais deste
// projeto — não existe cn()/buttonVariants/paleta primary-accent-muted aqui
// (confirmado: zero shadcn/Radix/CVA instalados). Troca 1:1:
//   bg-primary / text-primary-foreground (dia selecionado) -> bg-luva-amber / text-[#050914]
//     (mesmo par dourado+azul-escuro usado nos chips/toggles do wizard)
//   text-muted-foreground -> text-slate-400 ; bg-accent (hover) -> bg-white/10
//   buttonVariants({variant:'ghost'}) -> classe de botão-ícone inline
// Sem CSS externo — o DayPicker roda 100% headless, estilizado só via
// `classNames` (react-day-picker v10, confirmado nos tipos instalados).
//
// `text-[#ffffff]` (não `text-white`): globals.css:600-607 neutraliza a
// classe `.text-white` para #0f172a em todo o app, sem escopo — o mesmo
// escape-hatch de valor arbitrário já usado em `text-[#050914]` abaixo.
function Calendar({ className, classNames, showOutsideDays = true, components: userComponents, ...props }: CalendarProps) {
  const navButtonClass =
    'inline-flex size-9 items-center justify-center rounded-lg p-0 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40'

  const defaultClassNames = {
    months: 'relative flex flex-col gap-4',
    month: 'w-full',
    month_caption: 'relative mx-10 mb-1 flex h-9 items-center justify-center',
    caption_label: 'text-sm font-black text-[#ffffff]',
    nav: 'absolute top-0 flex w-full justify-between',
    button_previous: navButtonClass,
    button_next: navButtonClass,
    weekday: 'size-9 p-0 text-xs font-bold text-slate-400',
    day_button:
      'relative flex size-9 items-center justify-center rounded-lg p-0 text-sm font-bold text-[#ffffff] outline-offset-2 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-luva-amber/70 disabled:pointer-events-none disabled:text-slate-600',
    day: 'group size-9 p-0 text-sm',
    range_start: 'range-start',
    range_end: 'range-end',
    range_middle: 'range-middle',
    today: '[&>button]:border [&>button]:border-luva-amber/60',
    outside: 'text-slate-600',
    hidden: 'invisible',
    week_number: 'size-9 p-0 text-xs font-bold text-slate-400',
    selected: '[&>button]:bg-luva-amber [&>button]:text-[#050914] [&>button]:hover:bg-luva-amber',
  }

  const mergedClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => {
      const typedKey = key as keyof typeof defaultClassNames
      const extra = classNames?.[typedKey as keyof NonNullable<typeof classNames>]
      acc[typedKey] = extra ? `${defaultClassNames[typedKey]} ${extra}` : defaultClassNames[typedKey]
      return acc
    },
    {} as typeof defaultClassNames,
  )

  const defaultComponents = {
    Chevron: (chevronProps: { orientation?: 'left' | 'right' | 'up' | 'down' }) =>
      chevronProps.orientation === 'left' ? (
        <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
      ),
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={['w-fit', className].filter(Boolean).join(' ')}
      classNames={mergedClassNames}
      components={{ ...defaultComponents, ...userComponents }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }
