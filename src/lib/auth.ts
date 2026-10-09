import { createHmac, timingSafeEqual } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_SESSION_SCOPE, configuredAdminEmail, isAdminSession } from '@/lib/admin-access'

const COOKIE_NAME = 'luva_token'
export const OFFICIAL_ADMIN_EMAIL = configuredAdminEmail() || ''

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

export function passwordResetFingerprint(senhaHash: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return createHmac('sha256', secret).update(senhaHash).digest('hex')
}

export function fingerprintsMatch(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length === 0 || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

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
  scope: 'password-reset'
  adminId: number
  email: string
  senhaFingerprint: string
}

export type AccountActivationPayload = {
  purpose: 'account-activation'
  candidaturaId: string
  email: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, scope: ADMIN_SESSION_SCOPE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())
}

export async function signPublicToken(payload: PublicJWTPayload): Promise<string> {
  return new SignJWT({ ...payload, scope: 'public-user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())
}

export async function readPublicSession(): Promise<PublicJWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.scope !== 'public-user') return null
    return payload as unknown as PublicJWTPayload
  } catch {
    return null
  }
}

export async function verifyPublicToken(req: NextRequest): Promise<PublicJWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) return null

    const { payload } = await jwtVerify(token, getSecret())
    if (payload.scope !== 'public-user') return null
    return payload as unknown as PublicJWTPayload
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

export async function signPasswordResetToken(input: {
  adminId: number
  email: string
  senhaHash: string
}): Promise<string> {
  return new SignJWT({
    purpose: 'password-reset',
    scope: 'password-reset',
    adminId: input.adminId,
    email: input.email,
    senhaFingerprint: passwordResetFingerprint(input.senhaHash),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(getSecret())
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.purpose !== 'password-reset' || payload.scope !== 'password-reset') return null
    if (payload.senhaHash != null) return null
    if (typeof payload.senhaFingerprint !== 'string' || payload.senhaFingerprint.length === 0) return null
    if (typeof payload.email !== 'string' || payload.adminId == null) return null
    return payload as unknown as PasswordResetPayload
  } catch {
    return null
  }
}

export async function signAccountActivationToken(payload: Omit<AccountActivationPayload, 'purpose'>): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'account-activation', scope: 'account-activation' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyAccountActivationToken(token: string): Promise<AccountActivationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.purpose !== 'account-activation') return null
    return payload as unknown as AccountActivationPayload
  } catch {
    return null
  }
}

export async function verifyToken(req: NextRequest): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) return null

    const { payload } = await jwtVerify(token, getSecret())
    if (!isAdminSession(payload)) return null
    return payload as unknown as JWTPayload
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

export function setTokenCookie(token: string): { name: string; value: string; options: object } {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    },
  }
}
