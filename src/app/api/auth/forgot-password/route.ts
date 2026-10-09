import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { signPasswordResetToken } from '@/lib/auth'
import { emailRecuperacaoSenha, sendEmail } from '@/lib/email'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'

const JANELA_RECUPERACAO_MS = 60 * 60 * 1000

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  const ip = ipDaRequisicao(req)
  if (!consumirLimite(`forgot:ip:${ip}`, 5, JANELA_RECUPERACAO_MS).ok) {
    return error('Não foi possível solicitar recuperação agora. Tente mais tarde.', 429)
  }
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('E-mail inválido', 422)

    const email = parsed.data.email.toLowerCase().trim()
    if (!consumirLimite(`forgot:email:${email}`, 3, JANELA_RECUPERACAO_MS).ok) {
      return error('Não foi possível solicitar recuperação agora. Tente mais tarde.', 429)
    }
    const { data: admin } = await supabase
      .from('Admin')
      .select('id,email,nome,senhaHash')
      .eq('email', email)
      .maybeSingle()

    if (admin) {
      const token = await signPasswordResetToken({
        adminId: admin.id,
        email: admin.email,
        senhaHash: admin.senhaHash,
      })
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const resetUrl = `${baseUrl.replace(/\/$/, '')}/resetar-senha?token=${encodeURIComponent(token)}`

      await sendEmail({
        to: admin.email,
        subject: 'Recuperação de senha - volei.space',
        html: emailRecuperacaoSenha(admin.nome || 'Administrador', resetUrl),
      })
    }

    return success({ mensagem: 'Se o e-mail existir na plataforma, enviaremos um link de recuperação.' })
  } catch (err) {
    console.error('[auth/forgot-password] erro', err)
    return error('Não foi possível solicitar recuperação agora', 500)
  }
}
