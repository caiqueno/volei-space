import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { idInteiroPositivoSchema, mensagemAprovacaoSchema } from '@/lib/schemas'

async function idDaRota(params: Promise<{ id: string }>) {
  const { id } = await params
  return idInteiroPositivoSchema.safeParse(id)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const id = await idDaRota(params)
  if (!id.success) return error('Identificador inválido.', 422)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return error('Dados inválidos', 422)
  }
  const parsed = mensagemAprovacaoSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  const { data, error: err } = await supabase
    .from('Mensagem')
    .update({ aprovada: parsed.data.aprovada })
    .eq('id', id.data)
    .select('id,ligaId,autor,texto,aprovada,criadoEm')
    .single()
  if (err) return error('Erro ao atualizar mensagem', 500)
  return success(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const id = await idDaRota(params)
  if (!id.success) return error('Identificador inválido.', 422)
  const { error: err } = await supabase.from('Mensagem').delete().eq('id', id.data)
  if (err) return error('Erro ao excluir mensagem', 500)
  return success({ deleted: true })
}
