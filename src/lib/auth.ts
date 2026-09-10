import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'luva_token'
export const OFFICIAL_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@luv.com.br').trim().toLowerCase()

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

export type JWTPayload = {
  adminId: number
  email: string
  nome: string
}

export type PublicUserRole = 'equipe' | 'arbitro' | 'quadra' | 'organizador'

export type PublicJWTPayload = {
  userId: string
  email: string
  nome: string
  tipo: PublicUserRole
  status: string
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
  senhaHash: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
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
  return payload
}

export async function signPasswordResetToken(payload: PasswordResetPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(getSecret())
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.purpose !== 'password-reset') return null
    return payload as unknown as PasswordResetPayload
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
    if (String(payload.email ?? '').trim().toLowerCase() !== OFFICIAL_ADMIN_EMAIL) return null
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
