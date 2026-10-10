import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => null)
    const ligaId = Number(body?.ligaId)
    const equipeId = Number(body?.equipeId)
    if (!Number.isInteger(ligaId) || !Number.isInteger(equipeId)) return error('Campeonato ou equipe invalidos.', 400)

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,quantidadeGrupos,classificadosPorGrupo,faseEliminatoria')
      .eq('id', ligaId)
      .single()

    if (ligaErr || !liga) return error('Campeonato nao encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Voce nao pode alterar a classificacao deste campeonato.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const locked = await hasKnockoutBracket(ligaId)
    if (locked) return error('O chaveamento eliminatorio ja foi confirmado ou iniciado. Alteracoes exigem acao administrativa explicita.', 409)

    const required = getRequiredEliminatoryTeams(liga.faseEliminatoria)
    if (required <= 0) return error('Este campeonato nao possui fase eliminatoria configurada.', 422)

    const { data: inscricao, error: inscricaoErr } = await supabase
      .from('InscricaoCampeonato')
      .select('id')
      .eq('ligaId', ligaId)
      .eq('equipeId', equipeId)
      .eq('status', 'APROVADA')
      .maybeSingle()
    if (inscricaoErr) {
      console.error('[classificacao/manual] erro ao validar inscrição', inscricaoErr)
      return error('Erro ao validar inscricao da equipe.', 500)
    }
    if (!inscricao) return error('Equipe nao pertence a este campeonato.', 404)

    const automaticIds = await getAutomaticClassifiedIds(ligaId, Number(liga.quantidadeGrupos ?? 1) * Number(liga.classificadosPorGrupo ?? 0))
    if (automaticIds.has(equipeId)) return error('Esta equipe ja esta classificada automaticamente.', 409)

    const { data: manualRows, error: manualErr } = await supabase
      .from('ClassificacaoEliminatoria')
      .select('equipeId')
      .eq('ligaId', ligaId)
    if (manualErr) {
      console.error('[classificacao/manual] erro ao ler classificações', manualErr)
      return error('Erro ao validar classificacoes manuais. Rode o SQL da classificacao eliminatoria no Supabase.', 500)
    }

    const manualIds = new Set((manualRows ?? []).map((row: any) => Number(row.equipeId)))
    if (manualIds.has(equipeId)) return error('Esta equipe ja foi classificada manualmente.', 409)
    if (automaticIds.size + manualIds.size >= required) return error('A quantidade necessaria de classificados ja foi preenchida.', 409)

    const { data, error: insertErr } = await supabase
      .from('ClassificacaoEliminatoria')
      .insert({
        ligaId,
        equipeId,
        organizadorId: auth.userId,
        origem: 'MANUAL',
      })
      .select('*, equipe:Equipe(id,nome)')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') return error('Esta equipe ja foi classificada manualmente.', 409)
      console.error('[classificacao/manual] erro ao classificar', insertErr)
      return error('Erro ao classificar equipe manualmente.', 500)
    }

    const equipeNome = Array.isArray(data.equipe) ? data.equipe[0]?.nome : data.equipe?.nome
    return success({
      registro: data,
      message: `${equipeNome ?? 'Equipe'} foi classificada manualmente pelo organizador.`,
    }, 201)
  } catch (err) {
    console.error('[classificacao/manual] erro', err)
    return error('Erro ao classificar equipe manualmente.', 500)
  }
}

async function hasKnockoutBracket(ligaId: number) {
  const { count, error: countErr } = await supabase
    .from('Partida')
    .select('id', { count: 'exact', head: true })
    .eq('ligaId', ligaId)
    .not('fase', 'is', null)
    .neq('fase', 'GRUPOS')
  if (countErr) throw countErr
  return (count ?? 0) > 0
}

async function getAutomaticClassifiedIds(ligaId: number, automaticLimit: number) {
  if (automaticLimit <= 0) return new Set<number>()

  const { data, error: classErr } = await supabase
    .from('ClassificacaoEntrada')
    .select('equipeId,posicao')
    .eq('ligaId', ligaId)
    .order('posicao', { ascending: true })
    .limit(automaticLimit)
  if (classErr) throw classErr
  return new Set((data ?? []).map((row: any) => Number(row.equipeId)))
}
