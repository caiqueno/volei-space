'use client'

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

/** Diálogo modal acessível: foco preso, Esc fecha, foco volta ao botão que abriu. */
export function Dialogo({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  const tituloId = useId()
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    caixa.current?.focus()
    return () => anterior?.focus?.()
  }, [])

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onFechar()
      return
    }
    if (e.key !== 'Tab' || !caixa.current) return
    const focaveis = Array.from(
      caixa.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    )
    if (focaveis.length === 0) return
    const primeiro = focaveis[0]!
    const ultimo = focaveis[focaveis.length - 1]!
    if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === caixa.current)) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-vs-border bg-vs-surface p-5 text-vs-text shadow-2xl outline-none sm:rounded-3xl"
      >
        <h2 id={tituloId} className="font-display text-2xl font-bold">
          {titulo}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

export const BTN_PRIMARIO =
  'inline-flex min-h-[48px] items-center justify-center rounded-full bg-vs-gold px-5 py-2 text-base font-bold text-vs-on-gold transition-colors hover:bg-vs-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
export const BTN_SECUNDARIO =
  'inline-flex min-h-[48px] items-center justify-center rounded-full border border-vs-border bg-vs-elevated px-5 py-2 text-base font-bold text-vs-text transition-colors hover:border-vs-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
