import type { BracketRoundView, BracketSlot, TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { getMataMataBracket } from '@/lib/mata-mata'

export type ChavePublica = {
  temMataMata: boolean
  rounds: BracketRoundView[]
  champion: TeamOption | null
  thirdPlace: BracketSlot | null
  podium: PodiumTeam[]
}

export async function carregarChavePublica(ligaId: number, categoriaCampeonatoId?: string | null): Promise<ChavePublica> {
  const bracket = await getMataMataBracket(ligaId, null, false, categoriaCampeonatoId)
  const temMataMata = bracket.rounds.length > 0
  const podium = temMataMata ? await getChampionshipPodium(ligaId, categoriaCampeonatoId) : []
  return {
    temMataMata,
    rounds: bracket.rounds,
    champion: bracket.champion,
    thirdPlace: bracket.thirdPlace,
    podium,
  }
}
