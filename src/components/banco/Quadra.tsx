'use client'

import { NUMERAL_POSICAO, ORDEM_QUADRA, rotuloJogador } from '@/lib/banco-ui/formacao'
import type { JogadorBanco, RascunhoPapeleta } from '@/lib/banco-ui/tipos'

/**
 * Quadra desenhada: a rede em cima, linha da frente IV-III-II e linha de trás V-VI-I.
 * Cada posição é um botão grande (mínimo 88 px de altura).
 */
export function Quadra({
  rascunho,
  elenco,
  editavel,
  onEscolher,
}: {
  rascunho: RascunhoPapeleta
  elenco: readonly JogadorBanco[]
  editavel: boolean
  onEscolher: (posicao: number) => void
}) {
  return (
    <div className="rounded-3xl border border-vs-border bg-[#0b2a4a] p-3">
      <p className="mb-2 rounded-md bg-white/90 py-1 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#0b1a2e]">Rede</p>
      <ul className="grid grid-cols-3 gap-2" aria-label="Posições da quadra">
        {ORDEM_QUADRA.map((posicao) => {
          const id = rascunho.slots[posicao]
          const jogador = id != null ? elenco.find((j) => j.jogadorId === id) : undefined
          const rotulo = id != null ? rotuloJogador(jogador) : 'Escolher'
          const ehCapitao = id != null && id === rascunho.capitaoId
          return (
            <li key={posicao}>
              <button
                type="button"
                disabled={!editavel}
                onClick={() => onEscolher(posicao)}
                aria-label={`Posição ${NUMERAL_POSICAO[posicao]}: ${id != null ? rotulo : 'vazia, toque para escolher o jogador'}${ehCapitao ? ', capitão' : ''}`}
                className={`flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${
                  id != null ? 'border-vs-gold bg-vs-surface text-vs-text' : 'border-dashed border-white/60 bg-black/30 text-white'
                } ${editavel ? 'hover:bg-vs-elevated' : 'cursor-default opacity-95'}`}
              >
                <span className="font-display text-2xl font-bold text-vs-gold">{NUMERAL_POSICAO[posicao]}</span>
                <span className="text-sm font-bold leading-tight">{rotulo}</span>
                {ehCapitao ? <span className="rounded bg-vs-gold px-1.5 text-xs font-bold text-vs-on-gold">Capitão</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
