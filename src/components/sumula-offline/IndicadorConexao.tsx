'use client'

import { modeloDoIndicador, type ChaveIndicador } from '@/lib/sumula-offline/politica'
import type { SnapshotFila } from '@/lib/sumula-offline/tipos'

const COR: Record<ChaveIndicador, string> = {
  salvo: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  sincronizando: 'border-blue-300 bg-blue-50 text-blue-900',
  pendente: 'border-amber-300 bg-amber-50 text-amber-900',
  offline: 'border-slate-400 bg-slate-100 text-slate-900',
  conflito: 'border-orange-400 bg-orange-50 text-orange-950',
  erro: 'border-red-300 bg-red-50 text-red-900',
}

const PONTO: Record<ChaveIndicador, string> = {
  salvo: 'bg-emerald-500',
  sincronizando: 'bg-blue-500 motion-safe:animate-pulse',
  pendente: 'bg-amber-500',
  offline: 'bg-slate-500',
  conflito: 'bg-orange-500',
  erro: 'bg-red-500',
}

interface Props {
  snapshot: Pick<SnapshotFila, 'status' | 'pendentes' | 'enviando' | 'erro' | 'modoLocal' | 'pendencias'> & {
    conflitoAberto?: boolean
    ultimoConflito?: SnapshotFila['ultimoConflito']
  }
  /** Pede nova tentativa (botão aparece em pendente/erro). */
  aoTentarDeNovo?: () => void
  className?: string
}

/**
 * Indicador fixo da súmula: Salvo / N pendentes / Sem conexão / Conflito.
 * Região `status` (leitor de tela anuncia mudanças); a cor nunca é o único sinal (sempre há texto).
 */
export function IndicadorConexao({ snapshot, aoTentarDeNovo, className = '' }: Props) {
  const modelo = modeloDoIndicador({ ...snapshot, externos: snapshot.ultimoConflito?.externos })
  const nPendencias = snapshot.pendencias.length
  const mostrarBotao = aoTentarDeNovo && (modelo.chave === 'erro' || modelo.chave === 'pendente')
  return (
    <div
      role={modelo.chave === 'erro' || modelo.chave === 'conflito' ? 'alert' : 'status'}
      aria-live={modelo.chave === 'erro' || modelo.chave === 'conflito' ? 'assertive' : 'polite'}
      data-status={modelo.chave}
      title={modelo.detalhe}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${COR[modelo.chave]} ${className}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${PONTO[modelo.chave]}`} />
      <span>{modelo.rotulo}</span>
      <span className="sr-only">{modelo.detalhe}</span>
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
