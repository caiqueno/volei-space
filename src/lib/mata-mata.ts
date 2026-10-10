import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { selecionarClassificados } from '@/lib/classificados'
import { FASES_ELIMINATORIAS, type FaseEliminatoria, formatEliminatoryPhase, getRequiredEliminatoryTeams, normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import { perdedorDaPartida, vencedorDaPartida } from '@/lib/resultado-partida'
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

export async function getClassifiedTeamIds(ligaId: number, categoriaCampeonatoId?: string | null): Promise<Set<number>> {
  let entradasQuery = supabase.from('ClassificacaoEntrada').select('equipeId,posicao').eq('ligaId', ligaId).order('posicao', { ascending: true })
  let gruposQuery = supabase.from('GrupoCampeonato').select('id,classificados').eq('ligaId', ligaId)
  let vinculosQuery = supabase.from('GrupoEquipeCampeonato').select('grupoId,equipeId').eq('ligaId', ligaId)
  let manuaisQuery = supabase.from('ClassificacaoEliminatoria').select('equipeId').eq('ligaId', ligaId)
  if (categoriaCampeonatoId) {
    entradasQuery = entradasQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    gruposQuery = gruposQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    vinculosQuery = vinculosQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    manuaisQuery = manuaisQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
  }

  const [{ data: liga }, { data: config }, { data: entradas }, { data: groupRows }, { data: groupLinks }, { data: manualRows }] = await Promise.all([
    supabase.from('Liga').select('formato,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais,faseEliminatoria').eq('id', ligaId).maybeSingle(),
    categoriaCampeonatoId
      ? supabase.from('CategoriaConfiguracao').select('formato,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais,faseEliminatoria').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).maybeSingle()
      : Promise.resolve({ data: null }),
    entradasQuery,
    gruposQuery,
    vinculosQuery,
    manuaisQuery,
  ])

  return selecionarClassificados({
    formato: config?.formato ?? liga?.formato,
    faseEliminatoria: config?.faseEliminatoria ?? liga?.faseEliminatoria,
    quantidadeGrupos: config?.quantidadeGrupos ?? liga?.quantidadeGrupos,
    classificadosPorGrupo: config?.classificadosPorGrupo ?? liga?.classificadosPorGrupo,
    melhoresClassificadosGerais: config?.melhoresClassificadosGerais ?? liga?.melhoresClassificadosGerais,
    ordenados: (entradas ?? []).map((row: any) => Number(row.equipeId)),
    grupos: (groupRows ?? []).map((group: any) => ({ id: Number(group.id), classificados: Number(group.classificados ?? 0) })),
    vinculos: (groupLinks ?? []).map((link: any) => ({ grupoId: Number(link.grupoId), equipeId: Number(link.equipeId) })),
    manuais: (manualRows ?? []).map((row: any) => Number(row.equipeId)),
  })
}

export function getMatchWinnerId(partida: { status: string; equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null; vencedorId?: number | null }): number | null {
  return vencedorDaPartida(partida)
}

export function getMatchLoserId(partida: { status: string; equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null; vencedorId?: number | null }): number | null {
  return perdedorDaPartida(partida)
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
  categoriaCampeonatoId?: string | null,
): Promise<{ rounds: BracketRoundView[]; champion: TeamOption | null; thirdPlace: BracketSlot | null }> {
  const [{ data: ligaCfg }, { data: config }] = await Promise.all([
    supabase.from('Liga').select('disputaTerceiroLugar,faseEliminatoria').eq('id', ligaId).maybeSingle(),
    categoriaCampeonatoId
      ? supabase.from('CategoriaConfiguracao').select('faseEliminatoria,disputaTerceiroLugar').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const faseDaChave = config?.faseEliminatoria || faseEliminatoria || ligaCfg?.faseEliminatoria
  const disputaTerceiroLugar = config?.disputaTerceiroLugar ?? ligaCfg?.disputaTerceiroLugar
  const bracketRounds = getBracketRounds(faseDaChave)
  const fases = bracketRounds.map((round) => round.fase)
  if (fases.length === 0) return { rounds: [], champion: null, thirdPlace: null }

  const semifinalRound = bracketRounds.find((round) => round.fase === 'SEMIFINAL')
  const fasesParaBuscar = semifinalRound ? [...fases, THIRD_PLACE_FASE] : fases

  let entradasQuery = supabase.from('ClassificacaoEntrada').select('equipeId,equipe:Equipe(id,nome,corHex,logoUrl)').eq('ligaId', ligaId)
  let partidasQuery = supabase
    .from('Partida')
    .select('id,fase,rodada,status,dataHora,localNome,setsPorA,setsPorB,vencedorId,sumulaToken,equipeAId,equipeBId,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex,logoUrl),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex,logoUrl),sets:SetPartida(numero,pontosA,pontosB)')
    .eq('ligaId', ligaId)
    .in('fase', fasesParaBuscar)
  if (categoriaCampeonatoId) {
    entradasQuery = entradasQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    partidasQuery = partidasQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
  }

  const [{ data: entradas }, classifiedIds, { data: partidas }] = await Promise.all([
    entradasQuery,
    getClassifiedTeamIds(ligaId, categoriaCampeonatoId),
    partidasQuery,
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
  const finalBruta = finalRound ? partidaBySlot.get(`${finalRound.fase}:1`) : null
  let champion: TeamOption | null = null
  if (finalPartida && finalBruta) {
    const winnerId = getMatchWinnerId(finalBruta)
    champion = winnerId === finalPartida.equipeA.id ? finalPartida.equipeA : winnerId === finalPartida.equipeB.id ? finalPartida.equipeB : null
  }

  let thirdPlace: BracketSlot | null = null
  if (semifinalRound && disputaTerceiroLugar !== false) {
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
