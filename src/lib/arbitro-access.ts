import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePublicRole, isReleasedPublicStatus, type PublicJWTPayload } from '@/lib/auth'
import { error } from '@/lib/api-response'

export type ArbitroPartidaAccess = {
  auth: PublicJWTPayload
  candidatura: {
    id: string
    nome: string
    email: string
    status: string
    arbitroId: number | null
  }
  partida: any
}

export async function requireArbitroPartidaAccess(
  req: NextRequest,
  token: string,
): Promise<ArbitroPartidaAccess | NextResponse> {
  const auth = await requirePublicRole(req, ['arbitro'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,arbitroId')
    .eq('id', auth.userId)
    .maybeSingle()

  if (candidaturaErr || !candidatura) return error('Cadastro de arbitro nao encontrado.', 404)
  if (!isReleasedPublicStatus(candidatura.status)) {
    return error('Cadastro de arbitro ainda nao liberado para operar partidas.', 403)
  }

  const { data: partida, error: partidaErr } = await supabase
    .from('Partida')
    .select('*, liga:Liga(*), equipeA:Equipe!equipeAId(*, jogadores:Jogador(*)), equipeB:Equipe!equipeBId(*, jogadores:Jogador(*)), presencas:SumulaPresenca(*, jogador:Jogador(*)), escala:EscalaArbitro(*, arbitro:Arbitro(*))')
    .eq('sumulaToken', token)
    .single()

  if (partidaErr || !partida) return error('Partida nao encontrada.', 404)

  const escala = Array.isArray(partida.escala) ? partida.escala : []
  if (escala.length > 0) {
    const arbitroId = Number(candidatura.arbitroId)
    const escalado = escala.some((item: any) => Number(item.arbitroId) === arbitroId)
    if (!arbitroId || !escalado) return error('Voce nao esta escalado para operar esta partida.', 403)
  }

  return { auth, candidatura, partida }
}
