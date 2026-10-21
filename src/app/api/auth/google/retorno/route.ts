import { NextRequest, NextResponse } from 'next/server'
import { error } from '@/lib/api-response'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumirLimiteAsync, ipDaRequisicao } from '@/lib/rate-limit'
import { emailDeAdministrador, listarPerfis } from '@/lib/login-sem-senha/perfis'
import { JANELA_LIMITE_MS, resumo } from '@/lib/login-sem-senha/config'
import {
  COOKIE_PKCE,
  MENSAGEM_GOOGLE_INDISPONIVEL,
  lerConfigSupabaseAuth,
  trocarCodigoGoogle,
  vincularIdentidade,
} from '@/lib/login-sem-senha/google'
import {
  anexarSessao,
  bloqueioPorFlag,
  payloadDeOnboarding,
  payloadDoPerfil,
  respostaDeErro,
} from '@/lib/login-sem-senha/sessao'

function limparPkce<T>(res: NextResponse<T>) {
  res.cookies.set(COOKIE_PKCE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 0 })
  return res
}

// O navegador chega aqui vindo do Google: em vez de JSON, a sessão é emitida e a pessoa segue para a área dela.
function redirecionar(req: NextRequest, caminho: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  return NextResponse.redirect(`${base}${caminho}`, 303)
}

export async function GET(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  const config = lerConfigSupabaseAuth()
  if (!config) return NextResponse.json({ error: MENSAGEM_GOOGLE_INDISPONIVEL }, { status: 503 })
  try {
    const limite = await consumirLimiteAsync(`google:ret:ip:${resumo(ipDaRequisicao(req))}`, 30, JANELA_LIMITE_MS, 'FECHADO')
    if (!limite.ok) return error('Muitas tentativas. Tente novamente em instantes.', 429)

    const codigo = req.nextUrl.searchParams.get('code')
    const verifier = req.cookies.get(COOKIE_PKCE)?.value
    if (!codigo || !verifier) return limparPkce(error('Entrada com Google inválida ou expirada. Comece de novo.', 400))

    const troca = await trocarCodigoGoogle(config, codigo, verifier)
    if (troca.tipo === 'nao-verificado') return limparPkce(error('O e-mail do Google não está verificado.', 403))
    if (troca.tipo === 'falha') return limparPkce(error('Não foi possível entrar com o Google. Tente novamente.', 401))

    const { email } = troca.usuario
    if (await emailDeAdministrador(supabaseAdmin, email)) {
      return limparPkce(error('Este e-mail só entra por senha.', 403))
    }
    const vinculo = await vincularIdentidade(supabaseAdmin, troca.usuario)
    if (vinculo.tipo === 'conflito') return limparPkce(error('Esta conta Google já está ligada a outro e-mail.', 409))

    const perfis = await listarPerfis(supabaseAdmin, email)
    if (perfis.length === 0) {
      return limparPkce(await anexarSessao(redirecionar(req, '/login?novaConta=1'), payloadDeOnboarding(email, 'google')))
    }
    const ativo = perfis[0]
    return limparPkce(await anexarSessao(redirecionar(req, ativo.perfil === 'ORGANIZADOR' ? '/painel' : '/meu-time'), payloadDoPerfil(ativo, email, 'google')))
  } catch (err) {
    return limparPkce(respostaDeErro(err, 'google/retorno'))
  }
}
