import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { signPasswordResetToken } from '@/lib/auth'
import { emailRecuperacaoSenha, sendEmail } from '@/lib/email'
import { checkRateLimit, ipDaRequisicao } from '@/lib/rate-limit'

const JANELA_RECUPERACAO_MS = 60 * 60 * 1000
const LIMITE_RECUPERACAO = 3
const MENSAGEM_PADRAO = 'Se o e-mail existir na plataforma, enviaremos um link de recuperação.'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('E-mail inválido', 422)

    const email = parsed.data.email.toLowerCase().trim()
    const ip = ipDaRequisicao(req)
    const opcoes = { limite: LIMITE_RECUPERACAO, janelaMs: JANELA_RECUPERACAO_MS }
    const [porIp, porEmail] = await Promise.all([
      checkRateLimit(`forgot:ip:${ip}`, opcoes),
      checkRateLimit(`forgot:email:${email}`, opcoes),
    ])
    // Acima do limite a resposta é idêntica à de sucesso: não revela o bloqueio
    // nem se o e-mail existe, e nenhum e-mail é enviado.
    if (!porIp.permitido || !porEmail.permitido) return success({ mensagem: MENSAGEM_PADRAO })

    const { data: admin, error: dbErr } = await supabase
      .from('Admin')
      .select('id,email,nome,senhaHash')
      .eq('email', email)
      .maybeSingle()

    if (dbErr) {
      console.error('[auth/forgot-password] erro ao consultar administrador', dbErr)
      return error('Não foi possível solicitar recuperação agora', 500)
    }

    if (admin?.senhaHash) {
      try {
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
      } catch (emailErr) {
        console.error('[auth/forgot-password] falha ao enviar e-mail', emailErr)
      }
    }

    return success({ mensagem: MENSAGEM_PADRAO })
  } catch (err) {
    console.error('[auth/forgot-password] erro', err)
    return error('Não foi possível solicitar recuperação agora', 500)
  }
}
