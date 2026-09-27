import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { duplicateDatabaseMessage, duplicateMessage, findCadastroDuplicate, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'

const publicoSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = publicoSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const email = normalizeCadastroEmail(parsed.data.email)
    const duplicate = await findCadastroDuplicate(email)
    if (duplicate) return error(duplicateMessage(duplicate), 409)

    const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
    const id = randomUUID()
    const { error: insertError } = await supabase.from('ContaPublico').insert({
      id,
      nome: parsed.data.nome.trim(),
      email,
      senhaHash,
      status: 'ATIVA',
    })
    if (insertError) throw insertError

    return success({ id }, 201)
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/publico] erro ao registrar conta', detail)
    return error('Não foi possível criar a conta de acompanhamento.', 500)
  }
}
