'use client'

import { Medal, Shield, Swords, Zap } from 'lucide-react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import { topCinco, type AtletaQuadro } from '@/lib/quadro-publico'
import { cartazRanking } from '@/lib/stories-cartaz'

const QUADROS = [
  { chave: 'ataque' as const, titulo: 'Top Atacantes', icone: Swords },
  { chave: 'bloqueio' as const, titulo: 'Top Bloqueadores', icone: Shield },
  { chave: 'saque' as const, titulo: 'Top Sacadores', icone: Zap },
]

const MEDALHA = ['text-vs-gold', 'text-vs-silver', 'text-vs-bronze', 'text-vs-muted', 'text-vs-muted']

export function TopCinco({ atletas, campeonato, logoCampeonato }: { atletas: AtletaQuadro[]; campeonato?: string; logoCampeonato?: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {QUADROS.map((quadro) => {
        const lista = topCinco(atletas, quadro.chave)
        const Icone = quadro.icone
        return (
          <section key={quadro.chave} aria-label={quadro.titulo} className="rounded-2xl border border-vs-border bg-vs-surface p-4">
            <header className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vs-elevated text-vs-gold">
                  <Icone size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="truncate font-display text-lg font-bold uppercase tracking-[0.04em] text-vs-text">{quadro.titulo}</h3>
              </span>
              <BotaoStoriesInstagram
                titulo={quadro.titulo}
                versao={lista.map((atleta) => atleta.jogadorId).join('-')}
                montar={({ link }) => cartazRanking(atletas, quadro.chave, link, campeonato, logoCampeonato)}
              />
            </header>
            {lista.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-vs-muted">Sem dados ainda</p>
            ) : (
              <ol className="mt-3 divide-y divide-vs-border">
                {lista.map((atleta, indice) => (
                  <li key={atleta.jogadorId} className={`flex items-center gap-3 ${indice === 0 ? 'min-h-14' : 'min-h-11'}`}>
                    <span className={`w-8 shrink-0 font-display text-sm font-bold ${MEDALHA[indice]}`}>{indice + 1}º</span>
                    {indice < 3 && <Medal size={16} className={MEDALHA[indice]} aria-hidden="true" />}
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <TeamIdentity nome={atleta.equipe} cor={atleta.corHex} logoUrl={atleta.logoUrl} compact showName={false} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-vs-text">{atleta.nome}</span>
                        <span className="block text-sm font-black leading-tight text-vs-text [overflow-wrap:anywhere]"><NomeEquipe nome={atleta.equipe} /></span>
                      </span>
                    </span>
                    <b className={`font-display font-bold tabular-nums ${indice === 0 ? 'text-3xl text-vs-gold' : 'text-xl text-vs-text'}`}>{atleta[quadro.chave]}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
