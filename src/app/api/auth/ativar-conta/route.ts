import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { checkRateLimit, ipDaRequisicao } from '@/lib/rate-limit'
import { setTokenCookie, signPublicToken, verifyAccountActivationToken } from '@/lib/auth'
import { colunaAusente } from '@/lib/coluna-ausente'

const schema = z.object({
  token: z.string().min(20),
})

const COLUNAS = 'id,nome,email,status,emailVerificadoEm'

async function lerCandidatura(id: string, email: string) {
  const ler = (colunas: string) =>
    supabase.from('CandidaturaOrganizador').select(colunas).eq('id', id).eq('email', email).maybeSingle()
  const completo = await ler(`${COLUNAS},trocarSenha`)
  if (completo.error && colunaAusente(completo.error, ['trocarSenha', 'does not exist', 'schema cache'])) {
    return ler(COLUNAS)
  }
  return completo
}

export async function POST(req: NextRequest) {
  const cota = await checkRateLimit(`ativar:ip:${ipDaRequisicao(req)}`, { limite: 20, janelaMs: 15 * 60 * 1000 })
  if (!cota.permitido) {
    const res = error('Muitas tentativas. Tente novamente em instantes.', 429)
    res.headers.set('Retry-After', String(cota.retryAfterSeconds))
    return res
  }
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422)

    const payload = await verifyAccountActivationToken(parsed.data.token)
    if (!payload) return error('Link inválido ou expirado', 400)

    const { data, error: leituraErr } = await lerCandidatura(payload.candidaturaId, payload.email)
    if (leituraErr) throw leituraErr
    const candidatura = data as unknown as {
      id: string
      nome: string
      email: string
      status: string
      emailVerificadoEm: string | null
      trocarSenha?: boolean | null
    } | null

    // O link vale uma vez: com o e-mail já verificado ele não abre sessão.
    if (!candidatura || candidatura.emailVerificadoEm) return error('Link inválido ou já utilizado', 400)

    // Consome o link de forma condicional; quem perder a corrida recebe 400.
    const { data: consumida, error: updateErr } = await supabase
      .from('CandidaturaOrganizador')
      .update({ emailVerificadoEm: new Date().toISOString() })
      .eq('id', candidatura.id)
      .is('emailVerificadoEm', null)
      .select('id')
    if (updateErr) throw updateErr
    if (!Array.isArray(consumida) || consumida.length === 0) return error('Link inválido ou já utilizado', 400)

    const token = await signPublicToken({
      userId: candidatura.id,
      email: candidatura.email,
      nome: candidatura.nome,
      tipo: 'organizador',
      status: candidatura.status,
      trocarSenha: candidatura.trocarSenha === true,
    })
    const cookie = setTokenCookie(token, 'navegador')
    const res = success({ mensagem: 'Conta ativada com sucesso.' })
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err) {
    console.error('[auth/ativar-conta] erro', err)
    return error('Não foi possível ativar a conta agora', 500)
  }
}
