import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { idInteiroPositivoSchema, mensagemSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let q = supabase
      .from('Mensagem')
      .select('id,ligaId,autor,texto,aprovada,criadoEm')
      .eq('aprovada', true)
      .order('criadoEm', { ascending: false })
    if (searchParams.has('ligaId')) {
      const ligaId = idInteiroPositivoSchema.safeParse(searchParams.get('ligaId'))
      if (!ligaId.success) return error('Identificador inválido.', 422)
      q = q.eq('ligaId', ligaId.data)
    }

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar mensagens', 500)
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  try {
    const body = await req.json()
    const parsed = mensagemSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { data, error: err } = await supabase
      .from('Mensagem')
      .insert({ ...parsed.data, aprovada: false })
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch {
    return error('Erro ao enviar mensagem', 500)
  }
}
