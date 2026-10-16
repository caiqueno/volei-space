'use client'

import { Printer, Undo2 } from 'lucide-react'
import { avisoDeOverrides } from '@/lib/sumula-ui/override'

/**
 * Correções que o desfazer de ponto não alcança (sanção sem ponto, troca entre pontos), aviso de
 * registros por decisão do árbitro e atalho para a súmula impressa. Alvos de toque de 44px.
 */
export function PainelCorrecoes({
  sancao,
  troca,
  overrides,
  hrefImpressao,
  onDesfazerSancao,
  onDesfazerTroca,
}: {
  sancao: string | null
  troca: string | null
  overrides: number
  /** Rota da súmula impressa. */
  hrefImpressao: string
  onDesfazerSancao: () => void
  onDesfazerTroca: () => void
}) {
  return (
    <section aria-label="Correções e impressão" className="mx-auto my-2 w-full max-w-3xl space-y-2 px-2">
      {overrides > 0 ? (
        <p role="status" className="rounded-lg border-2 border-amber-600 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          {avisoDeOverrides(overrides)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDesfazerSancao}
          disabled={!sancao}
          title={sancao ?? 'Nenhuma sanção sem ponto neste set'}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 size={16} aria-hidden="true" />
          Desfazer última sanção
        </button>
        <button
          type="button"
          onClick={onDesfazerTroca}
          disabled={!troca}
          title={troca ?? 'Nenhuma troca neste set'}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 size={16} aria-hidden="true" />
          Desfazer última troca
        </button>
        {/*
          Ponto de integração da fila offline (M12): a impressão lê a súmula já gravada pelo PUT. Quando a
          tela passar a gravar pela fila de eventos (useFilaSumula), liberar este link só depois de
          a fila esvaziar (pendências = 0) para a folha não sair sem os últimos lances.
        */}
        <a
          href={hrefImpressao}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-blue-700 bg-white px-3 text-sm font-semibold text-blue-900"
        >
          <Printer size={16} aria-hidden="true" />
          Imprimir súmula
        </a>
      </div>
    </section>
  )
}
