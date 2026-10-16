'use client'

import type { CaixaRegra as DadosCaixa } from '@/lib/sumula-ui/explicacao'

/** Caixa persistente (não é toast): fica na tela até o apontador fechar. */
export function CaixaRegra({ caixa, onFechar, className = '' }: { caixa: DadosCaixa; onFechar?: () => void; className?: string }) {
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
      <p className="mt-1 font-semibold">O que fazer: <span className="font-normal">{caixa.acao}</span></p>
      {onFechar ? (
        <button type="button" onClick={onFechar} className="mt-2 min-h-[44px] rounded-md border border-current px-4 font-semibold">
          Entendi
        </button>
      ) : null}
    </div>
  )
}
