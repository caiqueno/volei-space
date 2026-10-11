'use client'

import Link from 'next/link'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { BotaoChaveStories } from '@/components/stories/BotaoStoriesInstagram'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import type { PodiumTeam } from '@/lib/championship-podium'
import { comTimesProvisorios } from '@/lib/semi-provisoria'
import { useGruposProvisorios } from '@/lib/use-grupos-provisorios'

export function CampeonatoMataMata({
  ligaId,
  rounds,
  champion,
  thirdPlace,
  podium,
  finalizado,
  campeonato,
  logoCampeonato,
  categoriaId = null,
}: {
  ligaId: number
  rounds: BracketRoundView[]
  champion: TeamOption | null
  thirdPlace: BracketSlot | null
  podium: PodiumTeam[]
  finalizado: boolean
  campeonato?: string
  logoCampeonato?: string | null
  categoriaId?: string | null
}) {
  const grupos = useGruposProvisorios(ligaId, categoriaId, rounds.length > 0)
  const roundsVisiveis = comTimesProvisorios(rounds, grupos)
  if (rounds.length === 0 && podium.length === 0) return null

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-8">
      {finalizado && podium.length > 0 && (
        <article className="championship-card rounded-[1.75rem] border p-6">
          <p className="luva-kicker">Resultado</p>
          <h2 className="mt-2 font-display text-3xl font-black text-white">Campeão e pódio</h2>
          <p className="mt-2 text-sm font-semibold text-slate-200">1º, 2º e 3º saem das partidas de final e de 3º lugar.</p>
          <div className="mt-6">
            <PodioFinal podium={podium} />
          </div>
        </article>
      )}
      {rounds.length > 0 && (
        <article className="championship-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="luva-kicker">Eliminatória</p>
                <h2 className="mt-2 font-display text-3xl font-black text-white">Chave do mata-mata</h2>
              </div>
              <BotaoChaveStories chave={{ rounds, thirdPlace }} campeonato={campeonato} logoCampeonato={logoCampeonato} />
            </div>
            <Link href={`/fase-mata-mata?ligaId=${ligaId}`} className="text-sm font-black text-luva-amber">
              Abrir em tela cheia
            </Link>
          </div>
          <div className="mt-6">
            <ChaveamentoMataMata
              ligaId={ligaId}
              rounds={roundsVisiveis}
              champion={champion}
              thirdPlace={thirdPlace}
              organizerMode={false}
            />
          </div>
        </article>
      )}
    </section>
  )
}
