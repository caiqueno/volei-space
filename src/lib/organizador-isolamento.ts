import { NextRequest, NextResponse } from 'next/server'
import { requirePublicRole, verifyPublicToken } from '@/lib/auth'
import { error } from '@/lib/api-response'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function exigirOrganizadorDaLiga(req: NextRequest, ligaId: number) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof NextResponse) return auth
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const { data, error: leitura } = await supabaseAdmin
    .from('Liga')
    .select('id,organizadorId')
    .eq('id', ligaId)
    .maybeSingle()
  if (leitura || !data) return error('Campeonato não encontrado.', 404)
  if (data.organizadorId !== auth.userId) return error('Acesso negado para este campeonato.', 403)
  return auth
}

export async function exigirOrganizadorDaEquipe(req: NextRequest, equipeId: number) {
  if (!Number.isInteger(equipeId)) return error('Equipe inválida.', 400)
  const { data, error: leitura } = await supabaseAdmin
    .from('Equipe')
    .select('ligaId')
    .eq('id', equipeId)
    .maybeSingle()
  if (leitura || !data) return error('Equipe não encontrada.', 404)
  return exigirOrganizadorDaLiga(req, Number(data.ligaId))
}

export async function exigirOrganizadorDoJogador(req: NextRequest, jogadorId: number) {
  if (!Number.isInteger(jogadorId)) return error('Jogador inválido.', 400)
  const { data, error: leitura } = await supabaseAdmin
    .from('Jogador')
    .select('equipeId')
    .eq('id', jogadorId)
    .maybeSingle()
  if (leitura || !data) return error('Jogador não encontrado.', 404)
  return exigirOrganizadorDaEquipe(req, Number(data.equipeId))
}

export async function ligasVisiveisAoOrganizador(req: NextRequest) {
  const auth = await verifyPublicToken(req)
  if (!auth || auth.tipo !== 'organizador') return null
  const { data } = await supabaseAdmin.from('Liga').select('id').eq('organizadorId', auth.userId)
  return (data ?? []).map((item) => Number(item.id))
}

export async function exigirOrganizadorDaPartida(req: NextRequest, partidaId: number) {
  if (!Number.isInteger(partidaId)) return error('Partida inválida.', 400)
  const { data, error: leitura } = await supabaseAdmin
    .from('Partida')
    .select('ligaId')
    .eq('id', partidaId)
    .maybeSingle()
  if (leitura || !data) return error('Partida não encontrada.', 404)
  return exigirOrganizadorDaLiga(req, Number(data.ligaId))
}
