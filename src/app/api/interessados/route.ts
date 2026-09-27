import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { interessadoSchema } from '@/lib/schemas'
import { errorDetail } from '@/lib/error-detail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = interessadoSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { data, error: insertErr } = await supabase
      .from('Interessado')
      .insert({ id: randomUUID(), ...parsed.data })
      .select('id')
      .single()

    if (insertErr) {
      if ((insertErr as { code?: string }).code === '23505') {
        return error('Você já está na nossa lista de interesse.', 409)
      }
      throw insertErr
    }

    return success({ id: data.id }, 201)
  } catch (err) {
    console.error('[interessados] erro ao registrar interessado', errorDetail(err))
    return error('Não foi possível registrar seu interesse. Tente novamente.', 500)
  }
}
