'use client'

import { textoDoIndicador } from '@/lib/sumula-offline/texto'
import type { SnapshotFila, StatusConexao } from '@/lib/sumula-offline/tipos'

const COR: Record<StatusConexao, string> = {
  online: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  sincronizando: 'border-blue-300 bg-blue-50 text-blue-900',
  pendente: 'border-amber-300 bg-amber-50 text-amber-900',
  offline: 'border-slate-300 bg-slate-100 text-slate-800',
  erro: 'border-red-300 bg-red-50 text-red-900',
}

const PONTO: Record<StatusConexao, string> = {
  online: 'bg-emerald-500',
  sincronizando: 'bg-blue-500 motion-safe:animate-pulse',
  pendente: 'bg-amber-500',
  offline: 'bg-slate-500',
  erro: 'bg-red-500',
}

interface Props {
  snapshot: Pick<SnapshotFila, 'status' | 'pendentes' | 'enviando' | 'erro' | 'modoLocal' | 'pendencias'>
  /** Pede nova tentativa (botão aparece em pendente/erro). */
  aoTentarDeNovo?: () => void
  className?: string
}

/** Indicador de conexão da súmula: região `status` (leitor de tela anuncia mudanças), cor nunca é o único sinal. */
export function IndicadorConexao({ snapshot, aoTentarDeNovo, className = '' }: Props) {
  const texto = textoDoIndicador(snapshot)
  const nPendencias = snapshot.pendencias.length
  const mostrarBotao = aoTentarDeNovo && (snapshot.status === 'erro' || (snapshot.status === 'pendente' && !snapshot.modoLocal))
  return (
    <div
      role={snapshot.status === 'erro' ? 'alert' : 'status'}
      aria-live={snapshot.status === 'erro' ? 'assertive' : 'polite'}
      data-status={snapshot.status}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${COR[snapshot.status]} ${className}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${PONTO[snapshot.status]}`} />
      <span>{texto}</span>
      {nPendencias > 0 && (
        <span className="rounded-full bg-white/70 px-2 text-xs font-semibold">
          {nPendencias} {nPendencias === 1 ? 'pendência' : 'pendências'} para o apontador
        </span>
      )}
      {mostrarBotao && (
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="min-h-[44px] rounded-full px-3 text-xs font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Tentar de novo
        </button>
      )}
    </div>
  )
}
