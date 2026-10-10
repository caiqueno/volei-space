import Link from 'next/link'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import type { PodiumTeam } from '@/lib/championship-podium'

export function CampeonatoMataMata({
  ligaId,
  rounds,
  champion,
  thirdPlace,
  podium,
  finalizado,
}: {
  ligaId: number
  rounds: BracketRoundView[]
  champion: TeamOption | null
  thirdPlace: BracketSlot | null
  podium: PodiumTeam[]
  finalizado: boolean
}) {
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
            <div>
              <p className="luva-kicker">Eliminatória</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Chave do mata-mata</h2>
            </div>
            <Link href={`/fase-mata-mata?ligaId=${ligaId}`} className="text-sm font-black text-luva-amber">
              Abrir em tela cheia
            </Link>
          </div>
          <div className="mt-6">
            <ChaveamentoMataMata
              ligaId={ligaId}
              rounds={rounds}
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
