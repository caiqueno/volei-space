import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { FASES_ELIMINATORIAS, type FaseEliminatoria, formatEliminatoryPhase, getRequiredEliminatoryTeams, normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import type { BracketRoundView, BracketSlot, TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'

export type BracketRound = { fase: FaseEliminatoria; slots: number }

// Fase especial: não faz parte da progressão normal (não é alimentada por vencedores, e sim
// pelos dois perdedores da semifinal). Só existe quando a chave passa por uma semifinal.
export const THIRD_PLACE_FASE = 'TERCEIRO_LUGAR'

// A ordem de fases nunca inclui NENHUMA; a fase configurada na liga é a primeira rodada da chave.
const ORDERED_KNOCKOUT_PHASES = FASES_ELIMINATORIAS.filter((fase) => fase !== 'NENHUMA').slice().reverse()

export function getBracketRounds(faseEliminatoria?: string | null): BracketRound[] {
  const start = normalizeEliminatoryPhase(faseEliminatoria)
  if (start === 'NENHUMA') return []

  const startIndex = ORDERED_KNOCKOUT_PHASES.indexOf(start)
  return ORDERED_KNOCKOUT_PHASES.slice(startIndex).map((fase) => ({
    fase,
    slots: getRequiredEliminatoryTeams(fase) / 2,
  }))
}

export async function getClassifiedTeamIds(ligaId: number): Promise<Set<number>> {
  const [{ data: liga }, { data: entradas }, { data: groupRows }, { data: groupLinks }, { data: manualRows }] = await Promise.all([
    supabase.from('Liga').select('quantidadeGrupos,classificadosPorGrupo,faseEliminatoria').eq('id', ligaId).maybeSingle(),
    supabase.from('ClassificacaoEntrada').select('equipeId,posicao').eq('ligaId', ligaId).order('posicao', { ascending: true }),
    supabase.from('GrupoCampeonato').select('id,classificados').eq('ligaId', ligaId),
    supabase.from('GrupoEquipeCampeonato').select('grupoId,equipeId').eq('ligaId', ligaId),
    supabase.from('ClassificacaoEliminatoria').select('equipeId').eq('ligaId', ligaId),
  ])

  const orderedIds = (entradas ?? []).map((row: any) => Number(row.equipeId))
  const classified = new Set<number>()

  if ((groupRows ?? []).length && (groupLinks ?? []).length) {
    const groupOf = new Map<number, number>()
    ;(groupLinks ?? []).forEach((link: any) => groupOf.set(Number(link.equipeId), Number(link.grupoId)))

    const limitByGroup = new Map<number, number>()
    ;(groupRows ?? []).forEach((group: any) => limitByGroup.set(Number(group.id), Math.max(0, Number(group.classificados ?? 0))))

    const countByGroup = new Map<number, number>()
    orderedIds.forEach((equipeId) => {
      const grupoId = groupOf.get(equipeId)
      if (grupoId == null) return
      const limit = limitByGroup.get(grupoId) ?? 0
      const soFar = countByGroup.get(grupoId) ?? 0
      if (soFar < limit) {
        classified.add(equipeId)
        countByGroup.set(grupoId, soFar + 1)
      }
    })
  } else {
    const requiredClassified = getRequiredEliminatoryTeams(liga?.faseEliminatoria)
    const automaticLimit = Math.min(
      requiredClassified || orderedIds.length,
      Number(liga?.quantidadeGrupos ?? 1) * Number(liga?.classificadosPorGrupo ?? 0),
    )
    orderedIds.slice(0, Math.max(0, automaticLimit)).forEach((equipeId) => classified.add(equipeId))
  }

  ;(manualRows ?? []).forEach((row: any) => classified.add(Number(row.equipeId)))

  return classified
}

export function getMatchWinnerId(partida: { status: string; equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null }): number | null {
  const finished = partida.status === 'ENCERRADA' || partida.status === 'WO'
  if (!finished) return null
  const a = Number(partida.setsPorA ?? 0)
  const b = Number(partida.setsPorB ?? 0)
  if (a === b) return null
  return a > b ? partida.equipeAId : partida.equipeBId
}

export function getMatchLoserId(partida: { status: string; equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null }): number | null {
  const winnerId = getMatchWinnerId(partida)
  if (!winnerId) return null
  return winnerId === partida.equipeAId ? partida.equipeBId : partida.equipeAId
}

type LegPartida = { status: string; equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null }

// Vencedor agregado de um confronto de ida e volta (Liga.eliminatoriaIdaVolta):
// soma os sets de cada equipe nos dois jogos (por id de equipe, não por lado
// A/B, já que o mandante se inverte na volta) e compara o total. Retorna
// null se algum jogo não estiver encerrado ou se o agregado empatar — mesmo
// padrão de "indefinido, requer decisão manual" já usado por getMatchWinnerId
// para um único jogo empatado em sets.
export function getAggregateTwoLegWinnerId(leg1: LegPartida, leg2: LegPartida): number | null {
  const finished = (partida: LegPartida) => partida.status === 'ENCERRADA' || partida.status === 'WO'
  if (!finished(leg1) || !finished(leg2)) return null

  const setsByTeam = new Map<number, number>()
  const addLeg = (partida: LegPartida) => {
    setsByTeam.set(partida.equipeAId, (setsByTeam.get(partida.equipeAId) ?? 0) + Number(partida.setsPorA ?? 0))
    setsByTeam.set(partida.equipeBId, (setsByTeam.get(partida.equipeBId) ?? 0) + Number(partida.setsPorB ?? 0))
  }
  addLeg(leg1)
  addLeg(leg2)

  const teamIds = Array.from(setsByTeam.keys())
  if (teamIds.length !== 2) return null

  const [idA, idB] = teamIds
  const setsA = setsByTeam.get(idA) ?? 0
  const setsB = setsByTeam.get(idB) ?? 0
  if (setsA === setsB) return null
  return setsA > setsB ? idA : idB
}

export async function getMataMataBracket(
  ligaId: number,
  faseEliminatoria: string | null | undefined,
  organizerMode: boolean,
): Promise<{ rounds: BracketRoundView[]; champion: TeamOption | null; thirdPlace: BracketSlot | null }> {
  const bracketRounds = getBracketRounds(faseEliminatoria)
  const fases = bracketRounds.map((round) => round.fase)
  if (fases.length === 0) return { rounds: [], champion: null, thirdPlace: null }

  const semifinalRound = bracketRounds.find((round) => round.fase === 'SEMIFINAL')
  const fasesParaBuscar = semifinalRound ? [...fases, THIRD_PLACE_FASE] : fases

  const [{ data: entradas }, classifiedIds, { data: partidas }] = await Promise.all([
    supabase.from('ClassificacaoEntrada').select('equipeId,equipe:Equipe(id,nome,corHex,logoUrl)').eq('ligaId', ligaId),
    getClassifiedTeamIds(ligaId),
    supabase
      .from('Partida')
      .select('id,fase,rodada,status,dataHora,localNome,setsPorA,setsPorB,sumulaToken,equipeAId,equipeBId,equipeA:Equipe!equipeAId(id,nome,corHex,logoUrl),equipeB:Equipe!equipeBId(id,nome,corHex,logoUrl),sets:SetPartida(numero,pontosA,pontosB)')
      .eq('ligaId', ligaId)
      .in('fase', fasesParaBuscar),
  ])

  const teamById = new Map<number, TeamOption>()
  for (const row of entradas ?? []) {
    const equipe = Array.isArray((row as any).equipe) ? (row as any).equipe[0] : (row as any).equipe
    if (equipe?.id != null) teamById.set(Number(equipe.id), { id: Number(equipe.id), nome: equipe.nome, corHex: equipe.corHex, logoUrl: equipe.logoUrl })
  }

  const partidaBySlot = new Map<string, any>()
  for (const partida of partidas ?? []) {
    partidaBySlot.set(`${partida.fase}:${partida.rodada}`, partida)
  }

  const classifiedOptions = Array.from(classifiedIds).map((id) => teamById.get(id)).filter((team): team is TeamOption => Boolean(team))

  const rounds: BracketRoundView[] = bracketRounds.map((round, roundIndex) => {
    const previousRound = roundIndex > 0 ? bracketRounds[roundIndex - 1] : null
    const usedInThisRound = new Set<number>()
    for (const partida of partidas ?? []) {
      if (partida.fase === round.fase) {
        usedInThisRound.add(Number(partida.equipeAId))
        usedInThisRound.add(Number(partida.equipeBId))
      }
    }

    const slots: BracketSlot[] = []
    for (let slotNumber = 1; slotNumber <= round.slots; slotNumber += 1) {
      const partida = partidaBySlot.get(`${round.fase}:${slotNumber}`)

      let eligibleOptions: TeamOption[] | null = null
      if (!partida) {
        if (roundIndex === 0) {
          eligibleOptions = classifiedOptions.filter((team) => !usedInThisRound.has(team.id))
        } else if (previousRound) {
          const feederA = partidaBySlot.get(`${previousRound.fase}:${slotNumber * 2 - 1}`)
          const feederB = partidaBySlot.get(`${previousRound.fase}:${slotNumber * 2}`)
          const winnerA = feederA ? getMatchWinnerId(feederA) : null
          const winnerB = feederB ? getMatchWinnerId(feederB) : null
          if (winnerA && winnerB) {
            eligibleOptions = [teamById.get(winnerA), teamById.get(winnerB)].filter((team): team is TeamOption => Boolean(team))
          }
        }
      }

      slots.push({
        fase: round.fase,
        rodada: slotNumber,
        partida: partida
          ? {
              id: partida.id,
              status: partida.status,
              equipeA: normalizeTeam(partida.equipeA),
              equipeB: normalizeTeam(partida.equipeB),
              setsPorA: partida.setsPorA,
              setsPorB: partida.setsPorB,
              sets: partida.sets ?? [],
              sumulaToken: organizerMode ? partida.sumulaToken : null,
            }
          : null,
        eligibleOptions,
      })
    }

    return { fase: round.fase, label: formatEliminatoryPhase(round.fase), slots }
  })

  const finalRound = rounds[rounds.length - 1]
  const finalPartida = finalRound?.slots[0]?.partida
  let champion: TeamOption | null = null
  if (finalPartida) {
    const winnerId = getMatchWinnerId({ status: finalPartida.status, equipeAId: finalPartida.equipeA.id, equipeBId: finalPartida.equipeB.id, setsPorA: finalPartida.setsPorA, setsPorB: finalPartida.setsPorB })
    champion = winnerId === finalPartida.equipeA.id ? finalPartida.equipeA : winnerId === finalPartida.equipeB.id ? finalPartida.equipeB : null
  }

  let thirdPlace: BracketSlot | null = null
  if (semifinalRound) {
    const partida = partidaBySlot.get(`${THIRD_PLACE_FASE}:1`)
    let eligibleOptions: TeamOption[] | null = null
    if (!partida) {
      const feederA = partidaBySlot.get(`${semifinalRound.fase}:1`)
      const feederB = partidaBySlot.get(`${semifinalRound.fase}:2`)
      const loserA = feederA ? getMatchLoserId(feederA) : null
      const loserB = feederB ? getMatchLoserId(feederB) : null
      if (loserA && loserB) {
        eligibleOptions = [teamById.get(loserA), teamById.get(loserB)].filter((team): team is TeamOption => Boolean(team))
      }
    }

    thirdPlace = {
      fase: THIRD_PLACE_FASE,
      rodada: 1,
      partida: partida
        ? {
            id: partida.id,
            status: partida.status,
            equipeA: normalizeTeam(partida.equipeA),
            equipeB: normalizeTeam(partida.equipeB),
            setsPorA: partida.setsPorA,
            setsPorB: partida.setsPorB,
            sets: partida.sets ?? [],
            sumulaToken: organizerMode ? partida.sumulaToken : null,
          }
        : null,
      eligibleOptions,
    }
  }

  return { rounds, champion, thirdPlace }
}

function normalizeTeam(value: any): TeamOption {
  const equipe = Array.isArray(value) ? value[0] : value
  return { id: Number(equipe?.id), nome: equipe?.nome ?? 'Equipe', corHex: equipe?.corHex ?? null, logoUrl: equipe?.logoUrl ?? null }
}
