import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { equipeSchema } from '@/lib/schemas'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error: err } = await supabase
    .from('Equipe')
    .select('*, jogadores:Jogador(*)')
    .eq('id', Number(id))
    .single()
  if (err) return error('Equipe não encontrada', 404)
  return success(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = equipeSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { data, error: err } = await supabase
      .from('Equipe')
      .update(parsed.data)
      .eq('id', Number(id))
      .select()
      .single()
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao atualizar equipe', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  const { error: err } = await supabase.from('Equipe').delete().eq('id', Number(id))
  if (err) return error('Erro ao excluir equipe', 500)
  return success({ deleted: true })
}
