'use client'

import { ChaveamentoMataMata } from '@/components/mata-mata/ChaveamentoMataMata'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import { BotaoChaveStories } from '@/components/stories/BotaoStoriesInstagram'
import type { ChavePublica } from '@/lib/portal-chave'

export function VistaChavePublica({ ligaId, chave, campeonato, logoCampeonato }: { ligaId: number; chave: ChavePublica; campeonato?: string; logoCampeonato?: string | null }) {
  if (!chave.temMataMata) return null

  return (
    <section className="grid gap-4" aria-label="Mata-mata">
      {chave.podium.length > 0 && (
        <article className="rounded-2xl border border-vs-border bg-vs-surface p-5">
          <p className="luva-kicker">Pódio</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-vs-text">Campeão, vice e 3º lugar</h2>
          <div className="mt-6">
            <PodioFinal podium={chave.podium} />
          </div>
        </article>
      )}
      <article className="rounded-2xl border border-vs-border bg-vs-bg p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="luva-kicker">Mata-mata</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-vs-text">Chave</h2>
          </div>
          <BotaoChaveStories chave={chave} campeonato={campeonato} logoCampeonato={logoCampeonato} />
        </div>
        <div className="mt-4">
          <ChaveamentoMataMata
            ligaId={ligaId}
            rounds={chave.rounds}
            champion={chave.champion}
            thirdPlace={chave.thirdPlace}
            organizerMode={false}
          />
        </div>
      </article>
    </section>
  )
}
