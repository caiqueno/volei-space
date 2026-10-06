import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { jogadorSchema } from '@/lib/schemas'
import { exigirOrganizadorDaEquipe, exigirOrganizadorDoJogador } from '@/lib/organizador-isolamento'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDoJogador(req, Number(id))
  if (acesso instanceof NextResponse) return acesso
  try {
    const body = await req.json()
    const parsed = jogadorSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    if (parsed.data.equipeId) {
      const destino = await exigirOrganizadorDaEquipe(req, parsed.data.equipeId)
      if (destino instanceof NextResponse) return destino
    }

    const { data, error: err } = await supabase
      .from('Jogador')
      .update(parsed.data)
      .eq('id', Number(id))
      .select()
      .single()
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao atualizar jogador', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDoJogador(req, Number(id))
  if (acesso instanceof NextResponse) return acesso
  const { error: err } = await supabase.from('Jogador').delete().eq('id', Number(id))
  if (err) return error('Erro ao excluir jogador', 500)
  return success({ deleted: true })
}
