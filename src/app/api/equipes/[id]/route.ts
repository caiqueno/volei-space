import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { equipeSchema } from '@/lib/schemas'
import { exigirOrganizadorDaEquipe, exigirOrganizadorDaLiga } from '@/lib/organizador-isolamento'
import { podeLerCampeonato } from '@/lib/leitura-publica'
import { EQUIPE_COLUNAS, EQUIPE_JOGADOR_COLUNAS } from '@/lib/projecoes-publicas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const equipeId = Number(id)
  if (!Number.isInteger(equipeId)) return error('Equipe não encontrada', 404)
  const { data, error: err } = await supabase
    .from('Equipe')
    .select(EQUIPE_COLUNAS)
    .eq('id', equipeId)
    .maybeSingle()
  if (err || !data) return error('Equipe não encontrada', 404)

  // Visitante só lê equipe de campeonato publicado; rascunho e simulação são do organizador dono.
  const { data: liga } = await supabase
    .from('Liga')
    .select('status,simulacao,organizadorId')
    .eq('id', data.ligaId)
    .maybeSingle()
  if (!(await podeLerCampeonato(req, liga))) return error('Equipe não encontrada', 404)

  const { data: jogadores, error: jogadoresErr } = await supabase
    .from('Jogador')
    .select(EQUIPE_JOGADOR_COLUNAS)
    .eq('equipeId', equipeId)
    .eq('banido', false)
  if (jogadoresErr) {
    console.error('[equipes] erro ao ler elenco', jogadoresErr)
    return error('Equipe não encontrada', 404)
  }
  return success({ ...data, jogadores: jogadores ?? [] })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDaEquipe(req, Number(id))
  if (acesso instanceof NextResponse) return acesso
  try {
    const body = await req.json()
    const parsed = equipeSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    if (parsed.data.ligaId) {
      const destino = await exigirOrganizadorDaLiga(req, parsed.data.ligaId)
      if (destino instanceof NextResponse) return destino
    }

    const { data, error: err } = await supabase
      .from('Equipe')
      .update(parsed.data)
      .eq('id', Number(id))
      .select(EQUIPE_COLUNAS)
      .single()
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao atualizar equipe', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDaEquipe(req, Number(id))
  if (acesso instanceof NextResponse) return acesso
  const { error: err } = await supabase.from('Equipe').delete().eq('id', Number(id))
  if (err) return error('Erro ao excluir equipe', 500)
  return success({ deleted: true })
}
