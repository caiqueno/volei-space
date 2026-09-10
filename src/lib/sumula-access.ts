import type { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'

export type SumulaTokenAccess = {
  partida: any
}

export async function requireSumulaTokenAccess(token: string): Promise<SumulaTokenAccess | NextResponse> {
  const { data: partida, error: partidaErr } = await supabase
    .from('Partida')
    .select('*, liga:Liga(*), equipeA:Equipe!equipeAId(*, jogadores:Jogador(*)), equipeB:Equipe!equipeBId(*, jogadores:Jogador(*)), presencas:SumulaPresenca(*, jogador:Jogador(*)), sets:SetPartida(*), ocorrencias:OcorrenciaPartida(*), destaques:DestaquesPartida(*, jogador:Jogador(*)), escala:EscalaArbitro(*, arbitro:Arbitro(*))')
    .eq('sumulaToken', token)
    .single()

  if (partidaErr || !partida) return error('Partida não encontrada.', 404)
  return { partida }
}
