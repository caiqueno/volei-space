import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { rotuloValido } from '@/lib/vaga-a-definir'
import { selecionarClassificados } from '@/lib/classificados'
import { FASES_ELIMINATORIAS, type FaseEliminatoria, formatEliminatoryPhase, getRequiredEliminatoryTeams, normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import { chaveDaVaga } from '@/lib/operacao-categoria'
import { rodadaDaVolta, vencedorAgregado } from '@/lib/ida-volta'
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

  const regras = categoriaCampeonatoId ? config : (config ?? liga)
  return selecionarClassificados({
    formato: regras?.formato,
    faseEliminatoria: regras?.faseEliminatoria,
    quantidadeGrupos: regras?.quantidadeGrupos,
    classificadosPorGrupo: regras?.classificadosPorGrupo,
    melhoresClassificadosGerais: regras?.melhoresClassificadosGerais,
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
  return vencedorAgregado(leg1, leg2)
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
  const faseDaChave = categoriaCampeonatoId
    ? (config?.faseEliminatoria ?? 'NENHUMA')
    : (config?.faseEliminatoria || faseEliminatoria || ligaCfg?.faseEliminatoria)
  const disputaTerceiroLugar = categoriaCampeonatoId
    ? config?.disputaTerceiroLugar
    : (config?.disputaTerceiroLugar ?? ligaCfg?.disputaTerceiroLugar)
  const bracketRounds = getBracketRounds(faseDaChave)
  const fases = bracketRounds.map((round) => round.fase)
  if (fases.length === 0) return { rounds: [], champion: null, thirdPlace: null }

  const semifinalRound = bracketRounds.find((round) => round.fase === 'SEMIFINAL')
  const fasesParaBuscar = semifinalRound ? [...fases, THIRD_PLACE_FASE] : fases

  let entradasQuery = supabase.from('ClassificacaoEntrada').select('equipeId,equipe:Equipe(id,nome,corHex,logoUrl)').eq('ligaId', ligaId)
  if (categoriaCampeonatoId) entradasQuery = entradasQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
  const selectPartidas = 'id,fase,rodada,status,dataHora,localNome,setsPorA,setsPorB,vencedorId,sumulaToken,categoriaCampeonatoId,equipeAId,equipeBId,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex,logoUrl),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex,logoUrl),sets:SetPartida(numero,pontosA,pontosB)'

  const [{ data: entradas }, classifiedIds, { data: partidas }] = await Promise.all([
    entradasQuery,
    getClassifiedTeamIds(ligaId, categoriaCampeonatoId),
    consultarComVaga(selectPartidas, (colunas) => {
      let partidasQuery = supabase.from('Partida').select(colunas).eq('ligaId', ligaId).in('fase', fasesParaBuscar)
      if (categoriaCampeonatoId) partidasQuery = partidasQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
      return partidasQuery
    }),
  ])

  const teamById = new Map<number, TeamOption>()
  for (const row of entradas ?? []) {
    const equipe = Array.isArray((row as any).equipe) ? (row as any).equipe[0] : (row as any).equipe
    if (equipe?.id != null) teamById.set(Number(equipe.id), { id: Number(equipe.id), nome: equipe.nome, corHex: equipe.corHex, logoUrl: equipe.logoUrl })
  }

  const categoriaChave = categoriaCampeonatoId ?? ''
  const partidaBySlot = new Map<string, any>()
  for (const partida of partidas ?? []) {
    partidaBySlot.set(chaveDaVaga(partida.categoriaCampeonatoId ?? categoriaChave, partida.fase, partida.rodada), partida)
  }
  const vaga = (fase: string, rodada: number) => partidaBySlot.get(chaveDaVaga(categoriaChave, fase, rodada))
  const vencedorDoSlot = (fase: string, rodada: number) => {
    const ida = vaga(fase, rodada)
    if (!ida) return null
    const volta = vaga(fase, rodadaDaVolta(rodada))
    if (!volta) return getMatchWinnerId(ida)
    return vencedorAgregado(ida, volta)
  }
  const perdedorDoSlot = (fase: string, rodada: number) => {
    const ida = vaga(fase, rodada)
    const vencedorId = vencedorDoSlot(fase, rodada)
    if (!ida || vencedorId == null) return null
    return vencedorId === Number(ida.equipeAId) ? Number(ida.equipeBId) : Number(ida.equipeAId)
  }

  const classifiedOptions = Array.from(classifiedIds).map((id) => teamById.get(id)).filter((team): team is TeamOption => Boolean(team))

  const rounds: BracketRoundView[] = bracketRounds.map((round, roundIndex) => {
    const previousRound = roundIndex > 0 ? bracketRounds[roundIndex - 1] : null
    const usedInThisRound = new Set<number>()
    for (const partida of partidas ?? []) {
      const mesmaCategoria = !categoriaCampeonatoId || partida.categoriaCampeonatoId === categoriaCampeonatoId
      if (partida.fase === round.fase && mesmaCategoria && Number(partida.rodada) <= rodadaDaVolta(0)) {
        if (Number(partida.equipeAId) > 0) usedInThisRound.add(Number(partida.equipeAId))
        if (Number(partida.equipeBId) > 0) usedInThisRound.add(Number(partida.equipeBId))
      }
    }

    const slots: BracketSlot[] = []
    for (let slotNumber = 1; slotNumber <= round.slots; slotNumber += 1) {
      const partida = vaga(round.fase, slotNumber)

      let eligibleOptions: TeamOption[] | null = null
      if (!partida) {
        if (roundIndex === 0) {
          eligibleOptions = classifiedOptions.filter((team) => !usedInThisRound.has(team.id))
        } else if (previousRound) {
          const winnerA = vencedorDoSlot(previousRound.fase, slotNumber * 2 - 1)
          const winnerB = vencedorDoSlot(previousRound.fase, slotNumber * 2)
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
              equipeA: ladoDoConfronto(partida.equipeA, partida.origemVagaA),
              equipeB: ladoDoConfronto(partida.equipeB, partida.origemVagaB),
              setsPorA: partida.setsPorA,
              setsPorB: partida.setsPorB,
              sets: partida.sets ?? [],
              sumulaToken: organizerMode ? partida.sumulaToken : null,
            }
          : null,
        eligibleOptions,
        volta: resumoDaPartida(vaga(round.fase, rodadaDaVolta(slotNumber)), organizerMode),
      })
    }

    return { fase: round.fase, label: formatEliminatoryPhase(round.fase), slots }
  })

  const finalRound = rounds[rounds.length - 1]
  const finalPartida = finalRound?.slots[0]?.partida
  const finalBruta = finalRound ? vaga(finalRound.fase, 1) : null
  let champion: TeamOption | null = null
  if (finalPartida && finalBruta) {
    const winnerId = vencedorDoSlot(finalRound.fase, 1)
    champion = winnerId === finalPartida.equipeA.id ? finalPartida.equipeA : winnerId === finalPartida.equipeB.id ? finalPartida.equipeB : null
  }

  let thirdPlace: BracketSlot | null = null
  if (semifinalRound && disputaTerceiroLugar !== false) {
    const partida = vaga(THIRD_PLACE_FASE, 1)
    let eligibleOptions: TeamOption[] | null = null
    if (!partida) {
      const loserA = perdedorDoSlot(semifinalRound.fase, 1)
      const loserB = perdedorDoSlot(semifinalRound.fase, 2)
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
            equipeA: ladoDoConfronto(partida.equipeA, partida.origemVagaA),
            equipeB: ladoDoConfronto(partida.equipeB, partida.origemVagaB),
            setsPorA: partida.setsPorA,
            setsPorB: partida.setsPorB,
            sets: partida.sets ?? [],
            sumulaToken: organizerMode ? partida.sumulaToken : null,
          }
        : null,
      eligibleOptions,
      volta: resumoDaPartida(vaga(THIRD_PLACE_FASE, rodadaDaVolta(1)), organizerMode),
    }
  }

  return { rounds, champion, thirdPlace }
}

function resumoDaPartida(partida: any, organizerMode: boolean) {
  if (!partida) return null
  return {
    id: partida.id,
    status: partida.status,
    equipeA: ladoDoConfronto(partida.equipeA, partida.origemVagaA),
    equipeB: ladoDoConfronto(partida.equipeB, partida.origemVagaB),
    setsPorA: partida.setsPorA,
    setsPorB: partida.setsPorB,
    sets: partida.sets ?? [],
    sumulaToken: organizerMode ? partida.sumulaToken : null,
  }
}

function ladoDoConfronto(value: any, origem: unknown): TeamOption {
  const equipe = Array.isArray(value) ? value[0] : value
  const id = Number(equipe?.id)
  if (equipe && Number.isInteger(id) && id > 0) {
    return { id, nome: equipe.nome ?? 'Equipe', corHex: equipe.corHex ?? null, logoUrl: equipe.logoUrl ?? null }
  }
  return { id: 0, nome: rotuloValido(origem) ?? 'A definir', corHex: null, logoUrl: null, vaga: true }
}
