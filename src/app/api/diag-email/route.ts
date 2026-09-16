import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { sendEmail } from '@/lib/email'

// Rota temporária de diagnóstico de SMTP. Remover depois de resolver o
// problema de envio de e-mail em produção.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.JWT_SECRET) {
    return error('Não autorizado', 401)
  }

  const mask = (value: string | undefined) => (value ? `${value.slice(0, 3)}...(len ${value.length})` : null)

  const env = {
    SMTP_HOST: process.env.SMTP_HOST || null,
    SMTP_PORT: process.env.SMTP_PORT || null,
    SMTP_USER: process.env.SMTP_USER || null,
    SMTP_PASS: mask(process.env.SMTP_PASS),
    EMAIL_FROM: process.env.EMAIL_FROM || null,
  }

  const to = req.nextUrl.searchParams.get('to')
  if (!to) {
    return success({ env, mensagem: 'Passe ?to=email@destino.com (além do token) para tentar um envio real.' })
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return error('SMTP não configurado neste ambiente', 500, { env })
  }

  try {
    await sendEmail({
      to,
      subject: 'Teste de SMTP - volei.space',
      html: '<p>Teste de envio de e-mail via /api/_diag/email-test.</p>',
    })
    return success({ env, enviado: true })
  } catch (err) {
    return error('Falha ao enviar e-mail de teste', 500, {
      env,
      erro: err instanceof Error ? err.message : String(err),
      detalhe: err instanceof Error ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))) : err,
    })
  }
}
