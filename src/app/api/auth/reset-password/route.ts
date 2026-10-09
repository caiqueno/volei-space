import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { verifyPasswordResetToken } from '@/lib/auth'
import { fingerprintSenha, fingerprintsConferem } from '@/lib/password-fingerprint'

const schema = z.object({
  token: z.string().min(20),
  senha: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422)

    const payload = await verifyPasswordResetToken(parsed.data.token)
    if (!payload) return error('Link inválido ou expirado', 400)

    const { data: admin } = await supabase
      .from('Admin')
      .select('id,senhaHash')
      .eq('id', payload.adminId)
      .eq('email', payload.email)
      .maybeSingle()

    const fingerprint = admin?.senhaHash ? fingerprintSenha(admin.senhaHash) : ''
    if (!admin?.senhaHash || !fingerprintsConferem(fingerprint, payload.senhaFingerprint)) {
      return error('Link inválido ou já utilizado', 400)
    }

    const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
    const { error: updateErr } = await supabase
      .from('Admin')
      .update({ senhaHash })
      .eq('id', payload.adminId)

    if (updateErr) throw updateErr
    return success({ mensagem: 'Senha redefinida com sucesso.' })
  } catch (err) {
    console.error('[auth/reset-password] erro', err)
    return error('Não foi possível redefinir a senha agora', 500)
  }
}
