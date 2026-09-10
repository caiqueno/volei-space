import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const { id } = await params

  try {
    const { data: candidatura, error: fetchErr } = await supabase
      .from('CandidaturaPartidaArbitro')
      .select('*, partida:Partida(id,status), candidatura:CandidaturaArbitro(id,nome,email,telefone,cref,diplomaUrl,status,arbitroId)')
      .eq('id', id)
      .single()

    if (fetchErr || !candidatura) return error('Candidatura de árbitro não encontrada.', 404)
    if (!['SOLICITADA', 'PENDENTE'].includes(String(candidatura.status ?? '').toUpperCase())) {
      return error('Esta candidatura já foi decidida.', 400)
    }

    const arbitroId = await ensureArbitro(candidatura.candidatura)
    if (!arbitroId) return error('Não foi possível localizar ou criar o perfil operacional do árbitro.', 500)

    const { data: escalaExistente } = await supabase
      .from('EscalaArbitro')
      .select('id')
      .eq('partidaId', candidatura.partidaId)
      .limit(1)

    if (escalaExistente?.length) return error('Esta partida já possui árbitro escalado.', 409)

    const { error: escalaErr } = await supabase
      .from('EscalaArbitro')
      .insert({
        partidaId: candidatura.partidaId,
        arbitroId,
        cargo: 'PRIMEIRO_ARBITRO',
      })

    if (escalaErr) {
      console.error('[admin/partidas-candidaturas/aprovar] erro ao escalar árbitro', escalaErr)
      return error('Erro ao escalar árbitro para a partida.', 500)
    }

    await supabase
      .from('CandidaturaPartidaArbitro')
      .update({ status: 'APROVADA', decididoEm: new Date().toISOString() })
      .eq('id', id)

    await supabase
      .from('CandidaturaPartidaArbitro')
      .update({ status: 'REJEITADA', decididoEm: new Date().toISOString() })
      .eq('partidaId', candidatura.partidaId)
      .neq('id', id)
      .in('status', ['SOLICITADA', 'PENDENTE'])

    return success({ aprovada: true, arbitroId })
  } catch (err) {
    console.error('[admin/partidas-candidaturas/aprovar] erro', err)
    return error('Erro ao aprovar candidatura de árbitro.', 500)
  }
}

async function ensureArbitro(candidatura: any) {
  if (!candidatura) return null
  if (candidatura.arbitroId) return candidatura.arbitroId

  const { data: existente } = await supabase
    .from('Arbitro')
    .select('id')
    .eq('email', candidatura.email)
    .maybeSingle()

  if (existente?.id) {
    await supabase
      .from('CandidaturaArbitro')
      .update({ status: 'APROVADA', arbitroId: existente.id })
      .eq('id', candidatura.id)
    return existente.id
  }

  const { data, error: insertErr } = await supabase
    .from('Arbitro')
    .insert({
      nome: candidatura.nome,
      email: candidatura.email,
      telefone: candidatura.telefone,
      cref: candidatura.cref,
      diplomaUrl: candidatura.diplomaUrl,
      aprovado: true,
    })
    .select('id')
    .single()

  if (insertErr || !data?.id) {
    console.error('[admin/partidas-candidaturas/aprovar] erro ao criar árbitro', insertErr)
    return null
  }

  await supabase
    .from('CandidaturaArbitro')
    .update({ status: 'APROVADA', arbitroId: data.id })
    .eq('id', candidatura.id)

  return data.id
}
