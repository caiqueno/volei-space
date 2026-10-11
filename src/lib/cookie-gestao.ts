import { decodeJwt } from 'jose'
import { ADMIN_SESSION_SCOPE } from '@/lib/admin-access'
import { sessaoGestaoExpirada } from '@/lib/sessao-gestao'

export const COOKIE_SESSAO = 'luva_token'
export const SESSION_MAX_AGE = 60 * 60 * 8

type OpcoesCookie = {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge?: number
}

export function tokenCookieOptions(maxAge?: number): OpcoesCookie {
  const options: OpcoesCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  }
  if (maxAge !== undefined) options.maxAge = maxAge
  return options
}

export function setTokenCookie(
  token: string,
  modo: 'persistente' | 'navegador' = 'persistente',
) {
  return {
    name: COOKIE_SESSAO,
    value: token,
    options: modo === 'navegador' ? tokenCookieOptions() : tokenCookieOptions(SESSION_MAX_AGE),
  }
}

export function clearTokenCookie() {
  return {
    name: COOKIE_SESSAO,
    value: '',
    options: tokenCookieOptions(0),
  }
}

export function classificarCookieGestao(token: string, agoraSegundos = Math.floor(Date.now() / 1000)) {
  try {
    const payload = decodeJwt(token)
    const admin = payload.scope === ADMIN_SESSION_SCOPE || payload.typ === 'admin'
    const organizador = payload.scope === 'public-user' && payload.tipo === 'organizador'
    if (!admin && !organizador) return 'outra' as const
    const exp = Number(payload.exp)
    if (!Number.isFinite(exp) || exp <= agoraSegundos) return 'expirada' as const
    if (sessaoGestaoExpirada(payload, agoraSegundos)) return 'expirada' as const
    return 'valida' as const
  } catch {
    return 'outra' as const
  }
}
