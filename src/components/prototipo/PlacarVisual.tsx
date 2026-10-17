'use client'

import type { EstadoPlacar, Lado } from '@/lib/prototipo/placar'
import { ATLETAS_EXEMPLO, TIME_A, TIME_B } from '@/lib/prototipo/exemplo'
import { CARTAO } from './Moldura'

const NOMES: Record<Lado, string> = { A: TIME_A, B: TIME_B }

export function PlacarVisual({ placar, grande = false }: { placar: EstadoPlacar; grande?: boolean }) {
  const num = grande ? 'text-8xl sm:text-9xl' : 'text-5xl'
  return (
    <section className={`${CARTAO} grid grid-cols-2 gap-3 text-center`} aria-label="Placar">
      {(['A', 'B'] as Lado[]).map((l) => (
        <div key={l}>
          <h2 className="text-sm font-semibold text-vs-muted">{NOMES[l]}</h2>
          <p className={`${num} font-extrabold tabular-nums text-vs-text`} aria-label={`${NOMES[l]}: ${placar.pontos[l]} pontos`}>
            {placar.pontos[l]}
          </p>
          <p className="text-sm text-vs-muted">
            Sets: <strong className="text-vs-text">{placar.sets[l]}</strong>
            {placar.saque === l ? <span className="ml-2 rounded bg-vs-blue px-2 py-0.5 text-xs font-bold text-white">Saque</span> : null}
          </p>
        </div>
      ))}
      <p className="col-span-2 text-sm text-vs-muted">
        {placar.vencedor ? `Fim de jogo: ${NOMES[placar.vencedor]} venceu` : `Set ${placar.set} em andamento`}
      </p>
    </section>
  )
}

const ORDEM_QUADRA = [3, 2, 1, 4, 5, 0] // exibe P4 P3 P2 / P5 P6 P1

export function QuadraRotacao({ lado, rotacao }: { lado: Lado; rotacao: number }) {
  const titulares = ATLETAS_EXEMPLO.slice(0, 6)
  return (
    <div className={CARTAO}>
      <h3 className="mb-2 font-semibold text-vs-text">
        Rotação — {NOMES[lado]} (giros: {rotacao})
      </h3>
      <ul className="grid grid-cols-3 gap-2" aria-label={`Posições em quadra do ${NOMES[lado]}`}>
        {ORDEM_QUADRA.map((pos) => {
          const atleta = titulares[(pos + rotacao) % 6]
          return (
            <li key={pos} className="rounded-xl border border-vs-border bg-vs-elevated p-2 text-center">
              <span className="block text-xs text-vs-muted">P{pos + 1}</span>
              <span className="block text-lg font-bold text-vs-text">{atleta.camisa}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Historico({ placar }: { placar: EstadoPlacar }) {
  return (
    <section className={CARTAO} aria-label="Histórico">
      <h3 className="mb-2 font-semibold text-vs-text">Histórico</h3>
      {placar.historico.length === 0 ? (
        <p className="text-vs-muted">Nenhum lance ainda. Marque um ponto na tela de placar.</p>
      ) : (
        <ul className="space-y-1 text-sm text-vs-text">
          {placar.historico.slice(0, 8).map((h, i) => (
            <li key={`${h}-${i}`}>{h}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
