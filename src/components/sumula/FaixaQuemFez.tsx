'use client'

import { useEffect, useRef, useState } from 'react'
import { ATRIBUICAO_JANELA_ESCOLHA_MS, ATRIBUICAO_JANELA_MS, origemPrecisaEscolherAtleta, type OpcaoOrigem } from '@/lib/atribuicao-ponto'
import type { OrigemPonto } from '@/lib/ponto-sumula'

export type AtletaEmQuadra = { numero: string; camisa: string; nome: string }

/**
 * Faixa que aparece 5 s depois do "+1": "Quem fez? [Saque] [Ataque] [Bloqueio]" e "Desfazer".
 * Não bloqueia a tela: o ponto já está gravado. Use `key={eventId}` para reiniciar a contagem a cada ponto.
 */
export function FaixaQuemFez({ equipeNome, opcoes, quadra, onSaque, onAtribuir, onDesfazer, onFechar }: {
  equipeNome: string
  opcoes: OpcaoOrigem[]
  quadra: AtletaEmQuadra[]
  onSaque: () => void
  onAtribuir: (origem: OrigemPonto, numero: string) => void
  onDesfazer: () => void
  onFechar: () => void
}) {
  const [escolhida, setEscolhida] = useState<OrigemPonto | null>(null)

  const fecharRef = useRef(onFechar)
  fecharRef.current = onFechar

  useEffect(() => {
    const timer = window.setTimeout(() => fecharRef.current(), escolhida ? ATRIBUICAO_JANELA_ESCOLHA_MS : ATRIBUICAO_JANELA_MS)
    return () => window.clearTimeout(timer)
  }, [escolhida])

  const botao = 'min-h-[48px] min-w-[48px] rounded-xl px-3 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="faixa-quem-fez"
      className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[60] mx-auto grid max-w-2xl gap-2 rounded-2xl border border-white/15 bg-[#07111f]/95 p-3 text-white shadow-2xl backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black">
          Ponto do {equipeNome}. <span className="text-amber-300">{escolhida ? 'Toque na camisa de quem fez' : 'Quem fez?'}</span>
        </p>
        <button type="button" onClick={onDesfazer} className={`${botao} border border-red-400/50 bg-red-500/15 text-red-100`}>Desfazer</button>
      </div>
      {!escolhida ? (
        <div className="grid grid-cols-3 gap-2">
          {opcoes.map((opcao) => (
            <button
              key={opcao.origem}
              type="button"
              onClick={() => origemPrecisaEscolherAtleta(opcao.origem) ? setEscolhida(opcao.origem) : onSaque()}
              className={`${botao} bg-[#ffb331] text-slate-950`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {quadra.map((atleta) => (
              <button
                key={atleta.numero}
                type="button"
                onClick={() => onAtribuir(escolhida, atleta.numero)}
                aria-label={`${atleta.nome}${atleta.camisa ? `, camisa ${atleta.camisa}` : ''}`}
                className={`${botao} border border-white/20 bg-white/10`}
              >
                {atleta.camisa || atleta.numero}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setEscolhida(null)} className="min-h-[40px] text-xs font-black text-slate-300 underline">Voltar</button>
        </div>
      )}
    </div>
  )
}
