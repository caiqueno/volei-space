import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  const body = await req.json()
  const { data, error: err } = await supabase
    .from('Mensagem')
    .update({ aprovada: body.aprovada })
    .eq('id', Number(id))
    .select()
    .single()
  if (err) return error('Erro ao atualizar mensagem', 500)
  return success(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  const { error: err } = await supabase.from('Mensagem').delete().eq('id', Number(id))
  if (err) return error('Erro ao excluir mensagem', 500)
  return success({ deleted: true })
}
