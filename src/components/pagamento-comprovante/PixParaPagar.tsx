'use client'

import { useEffect, useRef, useState } from 'react'
import { formatarReais, textoParaCopiar, type PixDoTime } from '@/lib/pagamento-comprovante-ui'

const botaoPequeno =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vs-border-strong)] px-4 text-sm font-bold text-[var(--vs-text)] hover:bg-[var(--vs-elevated)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

/** Quanto pagar e para onde (valor, chave Pix com botão de copiar, beneficiário e instruções). */
export function PixParaPagar({ valorCentavos, pix }: { valorCentavos: number; pix: PixDoTime }) {
  const [copiou, setCopiou] = useState<'sim' | 'nao' | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  async function copiar() {
    let ok = false
    try {
      await navigator.clipboard.writeText(textoParaCopiar(pix.chave))
      ok = true
    } catch {
      ok = false
    }
    setCopiou(ok ? 'sim' : 'nao')
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCopiou(null), 4000)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-black">
        Valor a pagar: <span className="text-[var(--vs-gold)]">{formatarReais(valorCentavos)}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-bold text-[var(--vs-muted)]">Chave Pix</dt>
        <dd className="break-all font-bold" data-testid="pix-chave">{pix.chave || 'Não informada'}</dd>
        <dt className="font-bold text-[var(--vs-muted)]">Quem recebe</dt>
        <dd>{pix.beneficiario || 'Não informado'}</dd>
      </dl>
      {pix.chave && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void copiar()} className={botaoPequeno}>Copiar chave</button>
          <p role="status" aria-live="polite" className={`text-sm font-bold ${copiou === 'nao' ? 'text-[var(--vs-error-fg)]' : 'text-[var(--vs-win)]'}`}>
            {copiou === 'sim' ? 'Chave copiada.' : copiou === 'nao' ? 'Não deu para copiar. Selecione a chave e copie.' : ''}
          </p>
        </div>
      )}
      {pix.instrucoes && <p className="whitespace-pre-line rounded-xl bg-[var(--vs-elevated)] p-3 text-sm">{pix.instrucoes}</p>}
    </div>
  )
}
