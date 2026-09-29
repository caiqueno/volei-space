import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { midiaSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ligaId = searchParams.get('ligaId')
    const ligaIds = (searchParams.get('ligaIds') ?? '')
      .split(',')
      .map((valor) => Number(valor))
      .filter((valor) => Number.isInteger(valor) && valor > 0)
      .slice(0, 40)
    const tag = searchParams.get('tag')

    let q = supabase.from('Midia').select('*').order('criadoEm', { ascending: false })
    if (ligaIds.length) q = q.in('ligaId', ligaIds)
    else if (ligaId) q = q.eq('ligaId', Number(ligaId))
    if (tag) q = q.eq('tag', tag)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar galeria', 500)
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  try {
    const body = await req.json()
    const parsed = midiaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { data, error: err } = await supabase.from('Midia').insert(parsed.data).select().single()
    if (err) throw err
    return success(data, 201)
  } catch {
    return error('Erro ao adicionar mídia', 500)
  }
}
