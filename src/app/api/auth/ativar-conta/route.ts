import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { setTokenCookie, signPublicToken, verifyAccountActivationToken } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(20),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422)

    const payload = await verifyAccountActivationToken(parsed.data.token)
    if (!payload) return error('Link inválido ou expirado', 400)

    const { data: candidatura } = await supabase
      .from('CandidaturaOrganizador')
      .select('id,nome,email,status,emailVerificadoEm')
      .eq('id', payload.candidaturaId)
      .eq('email', payload.email)
      .maybeSingle()

    if (!candidatura) return error('Link inválido ou já utilizado', 400)

    if (!candidatura.emailVerificadoEm) {
      const { error: updateErr } = await supabase
        .from('CandidaturaOrganizador')
        .update({ emailVerificadoEm: new Date().toISOString() })
        .eq('id', candidatura.id)

      if (updateErr) throw updateErr
    }

    const token = await signPublicToken({
      userId: candidatura.id,
      email: candidatura.email,
      nome: candidatura.nome,
      tipo: 'organizador',
      status: candidatura.status,
    })
    const cookie = setTokenCookie(token)
    const res = success({ mensagem: 'Conta ativada com sucesso.' })
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err) {
    console.error('[auth/ativar-conta] erro', err)
    return error('Não foi possível ativar a conta agora', 500)
  }
}
