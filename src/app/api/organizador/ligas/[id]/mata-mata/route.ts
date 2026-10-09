import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getBracketRounds, getClassifiedTeamIds, THIRD_PLACE_FASE } from '@/lib/mata-mata'
import { perdedoresDasSemifinais, vencedoresDosAlimentadores } from '@/lib/resultado-partida'
import { FASES_ELIMINATORIAS } from '@/lib/eliminatorias'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const { id } = await context.params
    const ligaId = Number(id)
    if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

    const body = await req.json().catch(() => null)
    const fase = String(body?.fase ?? '').toUpperCase()
    const rodada = Number(body?.rodada)
    const equipeAId = Number(body?.equipeAId)
    const equipeBId = Number(body?.equipeBId)

    const isThirdPlace = fase === THIRD_PLACE_FASE
    if ((!isThirdPlace && (!FASES_ELIMINATORIAS.includes(fase as any) || fase === 'NENHUMA'))) return error('Fase inválida.', 400)
    if (!Number.isInteger(rodada) || rodada < 1 || (isThirdPlace && rodada !== 1)) return error('Jogo inválido.', 400)
    if (!Number.isInteger(equipeAId) || !Number.isInteger(equipeBId) || equipeAId === equipeBId) {
      return error('Selecione dois times diferentes para o confronto.', 400)
    }

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,faseEliminatoria,disputaTerceiroLugar')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const rounds = getBracketRounds(liga.faseEliminatoria)
    const roundIndex = isThirdPlace ? -1 : rounds.findIndex((round) => round.fase === fase)
    if (!isThirdPlace) {
      if (roundIndex === -1) return error('Esta fase não faz parte do chaveamento deste campeonato.', 422)
      if (rodada > rounds[roundIndex].slots) return error('Este jogo não existe nessa fase.', 422)
    } else if (liga.disputaTerceiroLugar === false) {
      return error('Este campeonato não tem disputa de 3º lugar.', 422)
    } else if (!rounds.some((round) => round.fase === 'SEMIFINAL')) {
      return error('Este campeonato não tem disputa de 3º lugar (a chave não passa por uma semifinal).', 422)
    }

    const { count: existingCount, error: existingErr } = await supabase
      .from('Partida')
      .select('id', { count: 'exact', head: true })
      .eq('ligaId', ligaId)
      .eq('fase', fase)
      .eq('rodada', rodada)
    if (existingErr) return error('Erro ao verificar o confronto.', 500, existingErr.message)
    if ((existingCount ?? 0) > 0) return error('Este confronto já foi criado.', 409)

    if (isThirdPlace) {
      const { data: feeders, error: feedersErr } = await supabase
        .from('Partida')
        .select('rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId')
        .eq('ligaId', ligaId)
        .eq('fase', 'SEMIFINAL')
        .in('rodada', [1, 2])
      if (feedersErr) return error('Erro ao verificar a semifinal.', 500, feedersErr.message)
      const perdedores = perdedoresDasSemifinais(feeders ?? [])
      if (!perdedores) return error('Ainda falta o resultado de uma semifinal.', 422)
      const losers = new Set(perdedores)

      if (!losers.has(equipeAId) || !losers.has(equipeBId)) {
        return error('Os times selecionados precisam ser os perdedores das duas semifinais.', 422)
      }
    } else if (roundIndex === 0) {
      const classifiedIds = await getClassifiedTeamIds(ligaId)
      const { data: existingMatches, error: matchesErr } = await supabase
        .from('Partida')
        .select('equipeAId,equipeBId')
        .eq('ligaId', ligaId)
        .eq('fase', fase)
      if (matchesErr) return error('Erro ao verificar confrontos já criados.', 500, matchesErr.message)

      const usedIds = new Set<number>()
      ;(existingMatches ?? []).forEach((row: any) => {
        usedIds.add(Number(row.equipeAId))
        usedIds.add(Number(row.equipeBId))
      })

      for (const equipeId of [equipeAId, equipeBId]) {
        if (!classifiedIds.has(equipeId)) return error('Um dos times selecionados não está classificado para o mata-mata.', 422)
        if (usedIds.has(equipeId)) return error('Um dos times selecionados já está em outro confronto desta fase.', 409)
      }
    } else {
      const previousRound = rounds[roundIndex - 1]
      const feederRodadas = [rodada * 2 - 1, rodada * 2]
      const { data: feeders, error: feedersErr } = await supabase
        .from('Partida')
        .select('rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId')
        .eq('ligaId', ligaId)
        .eq('fase', previousRound.fase)
        .in('rodada', feederRodadas)
      if (feedersErr) return error('Erro ao verificar a rodada anterior.', 500, feedersErr.message)
      const classificadosDoSlot = vencedoresDosAlimentadores(feeders ?? [], rodada)
      if (!classificadosDoSlot) return error('Ainda falta o resultado de um confronto anterior desta chave.', 422)
      const winners = new Set(classificadosDoSlot)

      if (!winners.has(equipeAId) || !winners.has(equipeBId)) {
        return error('Os times selecionados precisam ser os vencedores dos dois confrontos anteriores desta chave.', 422)
      }
    }

    const { data: equipes, error: equipesErr } = await supabase
      .from('Equipe')
      .select('id,categoria,serie')
      .in('id', [equipeAId, equipeBId])
    if (equipesErr) return error('Erro ao carregar os times.', 500, equipesErr.message)
    const equipeA = (equipes ?? []).find((equipe: any) => equipe.id === equipeAId)
    const equipeB = (equipes ?? []).find((equipe: any) => equipe.id === equipeBId)
    if (!equipeA || !equipeB) return error('Um dos times selecionados não foi encontrado.', 404)

    const { data: partida, error: insertErr } = await supabase
      .from('Partida')
      .insert({
        ligaId,
        equipeAId,
        equipeBId,
        categoria: equipeA.categoria || equipeB.categoria || 'GERAL',
        serie: equipeA.serie || equipeB.serie || 'UNICA',
        rodada,
        status: 'AGENDADA',
        dataHora: null,
        localNome: 'A definir',
        sumulaToken: `luv-${ligaId}-${fase.toLowerCase()}-${rodada}-${equipeAId}-${equipeBId}`,
        grupoId: null,
        fase,
      })
      .select('id,rodada,fase,sumulaToken')
      .single()
    if (insertErr) return error('Erro ao criar o confronto.', 500, insertErr.message)

    return success(partida, 201)
  } catch (err) {
    return error('Erro ao criar o confronto.', 500, err instanceof Error ? err.message : err)
  }
}
