'use client'

import { useId, useState } from 'react'
import type { CaixaRegra as DadosCaixa } from '@/lib/sumula-ui/explicacao'
import { JUSTIFICATIVA_MINIMA, ROTULO_OVERRIDE, ehNaoConfirmado, justificativaValida, limparJustificativa } from '@/lib/sumula-ui/override'

/**
 * Saída para um bloqueio do motor: o árbitro decide, com justificativa obrigatória.
 * O botão só habilita com a justificativa preenchida; o servidor continua sendo a autoridade.
 */
export function OverrideArbitro({
  codigo,
  rotuloBotao = ROTULO_OVERRIDE,
  onConfirmar,
  onCancelar,
}: {
  codigo: string
  rotuloBotao?: string
  onConfirmar: (justificativa: string) => void
  onCancelar?: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const campoId = useId()
  const valida = justificativaValida(texto)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 min-h-[44px] w-full rounded-md border-2 border-amber-700 bg-white px-4 text-sm font-semibold text-amber-950"
      >
        {rotuloBotao}
      </button>
    )
  }
  return (
    <div className="mt-2 space-y-2 rounded-md border-2 border-amber-700 bg-white p-3 text-sm text-slate-900">
      <label htmlFor={campoId} className="block font-semibold">
        Justificativa do árbitro (obrigatória)
      </label>
      <textarea
        id={campoId}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        rows={2}
        maxLength={240}
        className="w-full rounded border border-slate-400 p-2"
        placeholder="Ex.: árbitro principal confirmou a decisão em quadra"
        aria-describedby={`${campoId}-ajuda`}
      />
      <p id={`${campoId}-ajuda`} className="text-xs text-slate-700">
        Mínimo de {JUSTIFICATIVA_MINIMA} caracteres. Fica gravada na súmula (marcada como decisão do árbitro, regra {codigo}) e aparece na impressão.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!valida}
          onClick={() => onConfirmar(limparJustificativa(texto))}
          className="min-h-[44px] flex-1 rounded-md bg-amber-700 px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rotuloBotao}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setTexto(''); onCancelar?.() }}
          className="min-h-[44px] rounded-md border border-slate-400 px-3 font-semibold"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}

/** Caixa persistente (não é toast): fica na tela até o apontador fechar. */
export function CaixaRegra({
  caixa,
  onFechar,
  onOverride,
  className = '',
}: {
  caixa: DadosCaixa
  onFechar?: () => void
  /** Presente: o bloqueio tem saída pela decisão do árbitro (com justificativa). */
  onOverride?: (justificativa: string) => void
  className?: string
}) {
  const bloqueio = caixa.tipo === 'bloqueio'
  return (
    <div
      role={bloqueio ? 'alert' : 'status'}
      className={`rounded-lg border-2 p-3 text-left text-sm ${bloqueio ? 'border-red-600 bg-red-50 text-red-950' : 'border-amber-500 bg-amber-50 text-amber-950'} ${className}`}
    >
      <p className="font-bold">
        <span className="mr-2 rounded bg-black/10 px-1.5 py-0.5 font-mono text-xs">{caixa.codigo}</span>
        {bloqueio ? 'Não foi possível registrar' : 'Atenção'}
      </p>
      <p className="mt-1">{caixa.mensagem}</p>
      {ehNaoConfirmado(caixa.codigo) ? (
        <p className="mt-1 text-xs font-semibold">Regra ainda não confirmada: o árbitro decide.</p>
      ) : null}
      <p className="mt-1 font-semibold">O que fazer: <span className="font-normal">{caixa.acao}</span></p>
      {bloqueio && onOverride ? <OverrideArbitro codigo={caixa.codigo} onConfirmar={onOverride} /> : null}
      {onFechar ? (
        <button type="button" onClick={onFechar} className="mt-2 min-h-[44px] rounded-md border border-current px-4 font-semibold">
          Entendi
        </button>
      ) : null}
    </div>
  )
}
