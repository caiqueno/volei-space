'use client'

import { GRADE_ZONAS, LEGENDA_QUADRA } from '@/lib/scout-ui/zonas'

/** Zonas 1 a 6 seguem a convenção da rede; zonas 7–9 (fundo) a confirmar com a COBRAV. */
export function MiniQuadra({ titulo, valor, onChange }: { titulo: string; valor: number | null; onChange: (z: number | null) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold text-vs-muted">{titulo}</legend>
      <p className="mb-1 text-xs text-vs-muted">{LEGENDA_QUADRA}</p>
      <div className="grid max-w-[220px] grid-cols-3 gap-1.5">
        {GRADE_ZONAS.flat().map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={valor === z}
            aria-label={`Zona ${z}`}
            onClick={() => onChange(valor === z ? null : z)}
            className={`min-h-[48px] rounded-lg border text-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              valor === z ? 'border-vs-gold bg-vs-gold text-vs-on-gold' : 'border-vs-border bg-vs-elevated text-vs-text hover:border-vs-muted'
            }`}
          >
            {z}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
