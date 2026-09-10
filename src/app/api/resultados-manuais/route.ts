import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { recalculateLeagueClassification, syncLeagueLifecycle } from '@/lib/championship-operations'

type ManualSetInput = {
  numero: number
  pontosA: number
  pontosB: number
}

export async function GET(req: NextRequest) {
  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY não configurada para resultados manuais.', 500)
  }

  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const ligaId = searchParams.get('ligaId')
  const status = searchParams.get('status')

  const { data: ligas, error: ligasErr } = await supabase
    .from('Liga')
    .select('id,nome,slug,organizadorId')
    .eq('organizadorId', auth.userId)

  if (ligasErr) return error('Erro ao buscar campeonatos do organizador.', 500)
  const ligaIds = (ligas ?? []).map((liga: any) => liga.id)
  if (ligaIds.length === 0) return success([])
  const filteredLigaIds = ligaId ? [Number(ligaId)].filter((id) => ligaIds.includes(id)) : ligaIds
  if (filteredLigaIds.length === 0) return success([])

  let query = supabase
    .from('Partida')
    .select('*, liga:Liga(id,nome,slug,setsPorPartida,pontosPorSet), equipeA:Equipe!equipeAId(id,nome,slug), equipeB:Equipe!equipeBId(id,nome,slug), sets:SetPartida(*)')
    .in('ligaId', filteredLigaIds)
    .order('dataHora', { ascending: false })
    .limit(80)

  if (status) query = query.eq('status', status)

  const { data, error: partidasErr } = await query
  if (partidasErr) return error('Erro ao buscar partidas para resultado manual.', 500)
  return success(data ?? [])
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY não configurada para resultados manuais.', 500)
  }

  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  try {
    const body = await req.json()
    const partidaId = Number(body.partidaId)
    const rawSets = Array.isArray(body.sets) ? body.sets : []

    if (!partidaId || rawSets.length === 0) {
      return error('Informe o placar de pelo menos um set.', 422)
    }

    const normalizedSets: ManualSetInput[] = rawSets
      .map((set: any, index: number) => ({
        numero: Number(set.numero ?? index + 1),
        pontosA: Number(set.pontosA),
        pontosB: Number(set.pontosB),
      }))
      .filter((set: ManualSetInput) => Number.isFinite(set.pontosA) && Number.isFinite(set.pontosB))

    const { data: partida, error: partidaErr } = await supabase
      .from('Partida')
      .select('id,ligaId,equipeAId,equipeBId,liga:Liga(id,organizadorId,setsPorPartida,pontosPorSet)')
      .eq('id', partidaId)
      .single()

    if (partidaErr || !partida) return error('Partida não encontrada.', 404)
    const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
    if (liga?.organizadorId !== auth.userId) {
      return error('Você não pode lançar resultado nesta partida.', 403)
    }

    const setsPorPartida = Math.max(1, Number(liga?.setsPorPartida ?? 3))
    const setsParaVencer = Math.floor(setsPorPartida / 2) + 1
    if (normalizedSets.length === 0 || normalizedSets.length > setsPorPartida) {
      return error(`Informe de 1 a ${setsPorPartida} set(s) para esta partida.`, 422)
    }

    const usedNumbers = new Set<number>()
    let setsPorA = 0
    let setsPorB = 0
    let pontosPorA = 0
    let pontosPorB = 0

    for (const set of normalizedSets) {
      if (!Number.isInteger(set.numero) || set.numero < 1 || set.numero > setsPorPartida || usedNumbers.has(set.numero)) {
        return error('A numeração dos sets está inválida.', 422)
      }
      if (![set.pontosA, set.pontosB].every((value) => Number.isInteger(value) && value >= 0)) {
        return error('Informe apenas pontos inteiros e positivos por set.', 422)
      }
      if (set.pontosA === set.pontosB) {
        return error(`O set ${set.numero} precisa ter um vencedor.`, 422)
      }
      usedNumbers.add(set.numero)
      pontosPorA += set.pontosA
      pontosPorB += set.pontosB
      if (set.pontosA > set.pontosB) setsPorA += 1
      if (set.pontosB > set.pontosA) setsPorB += 1
    }

    if (setsPorA === setsPorB || Math.max(setsPorA, setsPorB) < setsParaVencer) {
      return error(`O resultado precisa ter uma equipe com ${setsParaVencer} set(s) vencidos.`, 422)
    }
    if (setsPorA > setsParaVencer || setsPorB > setsParaVencer) {
      return error('O placar de sets ultrapassa o limite da partida.', 422)
    }

    const vencedorId = setsPorA > setsPorB ? partida.equipeAId : partida.equipeBId
    await supabase.from('SetPartida').delete().eq('partidaId', partidaId)
    const { error: setErr } = await supabase.from('SetPartida').insert(
      normalizedSets
        .sort((a, b) => a.numero - b.numero)
        .map((set) => ({
          partidaId,
          numero: set.numero,
          pontosA: set.pontosA,
          pontosB: set.pontosB,
        })),
    )
    if (setErr) throw setErr

    const { data: updated, error: updateErr } = await supabase
      .from('Partida')
      .update({
        status: 'ENCERRADA',
        setsPorA,
        setsPorB,
        pontosPorA,
        pontosPorB,
        vencedorId,
        sumulaSubmetidaEm: new Date().toISOString(),
        sumulaAprovadaEm: new Date().toISOString(),
      })
      .eq('id', partidaId)
      .select('*, liga:Liga(id,nome,slug,setsPorPartida,pontosPorSet), equipeA:Equipe!equipeAId(id,nome,slug), equipeB:Equipe!equipeBId(id,nome,slug), sets:SetPartida(*)')
      .single()

    if (updateErr) throw updateErr
    await recalculateLeagueClassification(partida.ligaId)
    await syncLeagueLifecycle(partida.ligaId)

    return success(updated)
  } catch (err) {
    console.error('[resultados-manuais] erro', err)
    return error('Erro ao lançar resultado manual.', 500)
  }
}
