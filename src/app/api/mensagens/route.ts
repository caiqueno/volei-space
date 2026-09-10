import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { mensagemSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ligaId = searchParams.get('ligaId')

    let q = supabase
      .from('Mensagem')
      .select('*')
      .eq('aprovada', true)
      .order('criadoEm', { ascending: false })
    if (ligaId) q = q.eq('ligaId', Number(ligaId))

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar mensagens', 500)
  }
}

export async function POST(req: NextRequest) {
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
