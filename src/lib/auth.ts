import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { configuredAdminEmail, isAdminSession } from '@/lib/admin-access'
import { fingerprintSenha } from '@/lib/password-fingerprint'
import { assinarToken, lerToken } from '@/lib/token-verify'

const COOKIE_NAME = 'luva_token'
const SESSION_MAX_AGE = 60 * 60 * 8
export const OFFICIAL_ADMIN_EMAIL = configuredAdminEmail() || ''

export type JWTPayload = {
  adminId: number
  email: string
  nome: string
}

export type PublicUserRole = 'equipe' | 'arbitro' | 'quadra' | 'organizador' | 'publico'

export type PublicJWTPayload = {
  userId: string
  email: string
  nome: string
  tipo: PublicUserRole
  status: string
  trocarSenha?: boolean
}

export const RELEASED_PUBLIC_STATUSES = ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO', 'LIBERADA', 'LIBERADO']

export function isReleasedPublicStatus(status?: string | null) {
  return RELEASED_PUBLIC_STATUSES.includes(String(status ?? '').trim().toUpperCase())
}

type RequirePublicRoleOptions = {
  releasedOnly?: boolean
}

export type PasswordResetPayload = {
  purpose: 'password-reset'
  adminId: number
  email: string
  senhaFingerprint: string
}

export type AccountActivationPayload = {
  purpose: 'account-activation'
  candidaturaId: string
  email: string
}

export function tokenCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return assinarToken({ ...payload }, 'admin', '8h')
}

export async function signPublicToken(payload: PublicJWTPayload): Promise<string> {
  return assinarToken({ ...payload, scope: 'public-user' }, 'public', '8h')
}

export async function readPublicSession(): Promise<PublicJWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    return lerSessaoPublica(token)
  } catch {
    return null
  }
}

async function lerSessaoPublica(token: string): Promise<PublicJWTPayload | null> {
  const payload = await lerToken<PublicJWTPayload & { scope?: unknown }>(token, 'public')
  if (!payload || payload.scope !== 'public-user') return null
  return payload
}

export async function verifyPublicToken(req: NextRequest): Promise<PublicJWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) return null
    return lerSessaoPublica(token)
  } catch {
    return null
  }
}

export async function requirePublicRole(
  req: NextRequest,
  roles: PublicUserRole[],
  options: RequirePublicRoleOptions = {},
): Promise<PublicJWTPayload | NextResponse> {
  const payload = await verifyPublicToken(req)
  if (!payload || !roles.includes(payload.tipo)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (options.releasedOnly && !isReleasedPublicStatus(payload.status)) {
    return NextResponse.json({ error: 'Perfil ainda não liberado para esta operação.' }, { status: 403 })
  }
  if ((payload.tipo === 'organizador' || payload.tipo === 'arbitro') && payload.trocarSenha === true) {
    return NextResponse.json({ error: 'Substitua a senha antes de continuar.' }, { status: 403 })
  }
  return payload
}

export async function signPasswordResetToken(input: { adminId: number; email: string; senhaHash: string }): Promise<string> {
  return assinarToken({
    purpose: 'password-reset',
    adminId: input.adminId,
    email: input.email,
    senhaFingerprint: fingerprintSenha(input.senhaHash),
  }, 'reset', '30m')
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetPayload | null> {
  const payload = await lerToken<PasswordResetPayload>(token, 'reset')
  if (!payload || payload.purpose !== 'password-reset') return null
  if (typeof payload.senhaFingerprint !== 'string' || !payload.senhaFingerprint) return null
  if ('senhaHash' in payload) return null
  return payload
}

export async function signAccountActivationToken(payload: Omit<AccountActivationPayload, 'purpose'>): Promise<string> {
  return assinarToken({ ...payload, purpose: 'account-activation' }, 'activation', '24h')
}

export async function verifyAccountActivationToken(token: string): Promise<AccountActivationPayload | null> {
  const payload = await lerToken<AccountActivationPayload>(token, 'activation')
  if (!payload || payload.purpose !== 'account-activation') return null
  return payload
}

export async function verifyToken(req: NextRequest): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) return null
    const payload = await lerToken<JWTPayload>(token, 'admin')
    if (!payload || !isAdminSession(payload)) return null
    return payload
  } catch {
    return null
  }
}

export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const payload = await verifyToken(req)
  if (!payload) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return null
}

export function setTokenCookie(token: string): { name: string; value: string; options: ReturnType<typeof tokenCookieOptions> } {
  return {
    name: COOKIE_NAME,
    value: token,
    options: tokenCookieOptions(SESSION_MAX_AGE),
  }
}

export function clearTokenCookie(): { name: string; value: string; options: ReturnType<typeof tokenCookieOptions> } {
  return {
    name: COOKIE_NAME,
    value: '',
    options: tokenCookieOptions(0),
  }
}
