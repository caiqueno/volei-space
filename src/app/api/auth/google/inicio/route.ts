import { NextRequest, NextResponse } from 'next/server'
import { bloqueioPorFlag } from '@/lib/login-sem-senha/sessao'
import {
  COOKIE_PKCE,
  MENSAGEM_GOOGLE_INDISPONIVEL,
  PKCE_MAX_AGE_SEGUNDOS,
  gerarPkce,
  lerConfigSupabaseAuth,
  urlDeAutorizacao,
} from '@/lib/login-sem-senha/google'

export async function GET(req: NextRequest) {
  const desligado = bloqueioPorFlag()
  if (desligado) return desligado
  const config = lerConfigSupabaseAuth()
  if (!config) return NextResponse.json({ error: MENSAGEM_GOOGLE_INDISPONIVEL }, { status: 503 })

  const base = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const { verifier, challenge } = gerarPkce()
  const res = NextResponse.redirect(urlDeAutorizacao(config, `${base}/api/auth/google/retorno`, challenge))
  res.cookies.set(COOKIE_PKCE, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: PKCE_MAX_AGE_SEGUNDOS,
  })
  return res
}
