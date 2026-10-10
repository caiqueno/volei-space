import { NextRequest } from 'next/server'
import { isSupabaseServiceConfigured, supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth, requirePublicRole } from '@/lib/auth'
import { ligaSchema } from '@/lib/schemas'
import { normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import { validateEliminatoryCapacity } from '@/lib/championship-validation'
import { isCampeonatoFinalizado, respostaCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data, error: err } = await supabase
    .from('Liga')
    .select('*')
    .eq('slug', slug)
    .single()

  if (err) return error('Liga nao encontrada', 404)
  return success(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const body = await req.json()
    const parsed = ligaSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados invalidos', 422, parsed.error.flatten())

    if (!isSupabaseServiceConfigured) {
      return error('SUPABASE_SERVICE_ROLE_KEY nao configurada no Vercel. Necessaria para editar campeonatos com RLS ativo.', 500)
    }

    const { data: ligaAtual, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,status')
      .eq('slug', slug)
      .single()

    if (ligaErr || !ligaAtual) return error('Liga nao encontrada', 404)
    if (isCampeonatoFinalizado(ligaAtual.status)) return respostaCampeonatoFinalizado()

    if (ligaAtual.organizadorId) {
      const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
      if (auth instanceof Response) return auth
      if (auth.userId !== ligaAtual.organizadorId) return error('Voce nao pode editar este campeonato.', 403)
      if (parsed.data.organizadorId && parsed.data.organizadorId !== ligaAtual.organizadorId) {
        return error('Voce nao pode transferir este campeonato para outro organizador.', 403)
      }
    } else {
      const authErr = await requireAuth(req)
      if (authErr) return authErr
    }

    if (parsed.data.status === 'ENCERRADA') {
      const { count, error: countError } = await supabase
        .from('Partida')
        .select('id', { count: 'exact', head: true })
        .eq('ligaId', ligaAtual.id)
        .not('status', 'in', '(ENCERRADA,CANCELADA)')
      if (countError) throw countError
      if ((count ?? 0) > 0) return error('Encerre ou cancele todas as partidas antes de encerrar o campeonato.', 422)
    }

    // Depois que o campeonato de um organizador já começou, só data término e
    // regra de pontuação podem mudar — o resto do payload é ignorado em vez de
    // rejeitado, para não gerar falso-positivo por diferença de serialização
    // em campos JSON (nomesGrupos, criteriosClassificacao, etc.).
    const EDITABLE_AFTER_START_FIELDS = ['dataFim', 'setsPorPartida', 'pontosPorSet', 'tieBreakUltimoSet', 'pontosUltimoSet'] as const
    const ligaJaIniciada = Boolean(ligaAtual.organizadorId) && ligaAtual.status !== 'EM_BREVE'
    const effectiveData = ligaJaIniciada
      ? Object.fromEntries(Object.entries(parsed.data).filter(([key]) => (EDITABLE_AFTER_START_FIELDS as readonly string[]).includes(key)))
      : parsed.data

    const validation = validateEliminatoryCapacity(effectiveData)
    if (validation) return error(validation, 422)

    const payload = normalizeLeaguePayload(effectiveData)

    const { data, error: err } = await supabase
      .from('Liga')
      .update(payload)
      .eq('slug', slug)
      .select()
      .single()

    if (err) throw err
    return success(data)
  } catch (err) {
    console.error('[ligas] erro ao atualizar', err)
    return error('Erro ao atualizar liga', 500)
  }
}

function normalizeLeaguePayload(data: any) {
  const formato = data.formato === 'COPA_CURTA' ? 'MATA_MATA' : data.formato
  const payload: any = {
    ...data,
    formato,
  }
  if (formato === 'PONTOS_CORRIDOS') payload.faseEliminatoria = 'NENHUMA'
  else if (data.faseEliminatoria !== undefined || data.formato !== undefined) payload.faseEliminatoria = normalizeEliminatoryPhase(data.faseEliminatoria || 'SEMIFINAL')
  return payload
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY nao configurada no Vercel. Necessaria para excluir campeonatos com RLS ativo.', 500)
  }

  const { slug } = await params
  try {
    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,slug,nome,organizadorId,status')
      .eq('slug', slug)
      .single()

    if (ligaErr || !liga) return error('Liga nao encontrada', 404)
    if (isCampeonatoFinalizado(liga.status)) return respostaCampeonatoFinalizado()

    if (liga.organizadorId) {
      const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
      if (auth instanceof Response) return auth
      if (auth.userId !== liga.organizadorId) return error('Voce nao pode excluir este campeonato.', 403)
    } else {
      const authErr = await requireAuth(req)
      if (authErr) return authErr
    }

    const { data: partidas } = await supabase.from('Partida').select('id').eq('ligaId', liga.id)
    const partidaIds = (partidas ?? []).map((partida: any) => partida.id)
    if (partidaIds.length > 0) {
      await supabase.from('DestaquesPartida').delete().in('partidaId', partidaIds)
      await supabase.from('OcorrenciaPartida').delete().in('partidaId', partidaIds)
      await supabase.from('SumulaPresenca').delete().in('partidaId', partidaIds)
      await supabase.from('SetPartida').delete().in('partidaId', partidaIds)
      await supabase.from('EscalaArbitro').delete().in('partidaId', partidaIds)
      await supabase.from('Partida').delete().in('id', partidaIds)
    }

    await supabase.from('InscricaoCampeonato').delete().eq('ligaId', liga.id)
    await supabase.from('ConviteEquipe').delete().eq('ligaId', liga.id)
    await supabase.from('Midia').delete().eq('ligaId', liga.id)
    await supabase.from('Mensagem').delete().eq('ligaId', liga.id)
    await supabase.from('Premiacao').delete().eq('ligaId', liga.id)
    await supabase.from('CandidaturaQuadra').delete().eq('ligaId', liga.id)
    await supabase.from('CandidaturaEquipe').delete().eq('ligaId', liga.id)

    const { error: deleteErr } = await supabase.from('Liga').delete().eq('id', liga.id)
    if (deleteErr) throw deleteErr

    return success({ deleted: true, slug: liga.slug })
  } catch (err) {
    console.error('[ligas] erro ao excluir', err)
    return error('Erro ao excluir campeonato', 500)
  }
}
