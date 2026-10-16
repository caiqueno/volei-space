import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_SESSION_SCOPE, configuredAdminEmail, isAdminSession } from '@/lib/admin-access'
import { COOKIE_SESSAO, classificarCookieGestao, setTokenCookie } from '@/lib/cookie-gestao'
import { fingerprintSenha, fingerprintsConferem } from '@/lib/password-fingerprint'
import { caminhoIsentoDeInatividade, sessaoGestaoExpirada } from '@/lib/sessao-gestao'
import { assinarToken, getSecret, lerToken } from '@/lib/token-verify'

export { getSecret }

export { classificarCookieGestao, setTokenCookie }
export { clearTokenCookie, tokenCookieOptions } from '@/lib/cookie-gestao'

const COOKIE_NAME = COOKIE_SESSAO
export const OFFICIAL_ADMIN_EMAIL = configuredAdminEmail() || ''

export const passwordResetFingerprint = fingerprintSenha
export const fingerprintsMatch = fingerprintsConferem

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
  return assinarToken({
    ...payload,
    scope: ADMIN_SESSION_SCOPE,
    act: Math.floor(Date.now() / 1000),
  }, 'admin', '2h')
}

export async function signPublicToken(payload: PublicJWTPayload): Promise<string> {
  const organizador = payload.tipo === 'organizador'
  return assinarToken({
    ...payload,
    scope: 'public-user',
    ...(organizador ? { act: Math.floor(Date.now() / 1000) } : {}),
  }, 'public', '8h')
}

export async function readPublicSession(): Promise<PublicJWTPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const payload = await lerSessaoPublica(token)
    if (!payload) return null
    if (payload.tipo === 'organizador' && sessaoGestaoExpirada(payload)) return null
    return payload
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
    const payload = await lerSessaoPublica(token)
    if (!payload) return null
    if (payload.tipo === 'organizador' && !caminhoIsentoDeInatividade(req.nextUrl.pathname) && sessaoGestaoExpirada(payload)) {
      return null
    }
    return payload
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
    scope: 'password-reset',
    adminId: input.adminId,
    email: input.email,
    senhaFingerprint: fingerprintSenha(input.senhaHash),
  }, 'reset', '30m')
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetPayload | null> {
  const payload = await lerToken<PasswordResetPayload>(token, 'reset')
  if (!payload || payload.purpose !== 'password-reset' || payload.scope !== 'password-reset') return null
  if (typeof payload.senhaFingerprint !== 'string' || !payload.senhaFingerprint) return null
  if (payload.adminId == null || typeof payload.email !== 'string') return null
  if ('senhaHash' in payload && (payload as { senhaHash?: unknown }).senhaHash != null) return null
  return payload
}

export async function signAccountActivationToken(payload: Omit<AccountActivationPayload, 'purpose'>): Promise<string> {
  return assinarToken({ ...payload, purpose: 'account-activation', scope: 'account-activation' }, 'activation', '24h')
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
    if (!payload || !isAdminSession(payload) || sessaoGestaoExpirada(payload)) return null
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

export type EstadoGestao =
  | { estado: 'ausente' }
  | { estado: 'outra' }
  | { estado: 'expirada' }
  | { estado: 'valida'; perfil: 'admin'; adminId: number; nome: string; email: string }
  | { estado: 'valida'; perfil: 'organizador'; payload: PublicJWTPayload }

export async function lerEstadoGestao(): Promise<EstadoGestao> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return { estado: 'ausente' }

    const admin = await lerToken<JWTPayload>(token, 'admin')
    if (admin && isAdminSession(admin)) {
      if (sessaoGestaoExpirada(admin)) return { estado: 'expirada' }
      return {
        estado: 'valida',
        perfil: 'admin',
        adminId: Number(admin.adminId),
        nome: admin.nome,
        email: admin.email,
      }
    }

    const publico = await lerSessaoPublica(token)
    if (publico?.tipo === 'organizador') {
      if (sessaoGestaoExpirada(publico)) return { estado: 'expirada' }
      return { estado: 'valida', perfil: 'organizador', payload: publico }
    }

    if (classificarCookieGestao(token) === 'expirada') return { estado: 'expirada' }
    return { estado: 'outra' }
  } catch {
    return { estado: 'ausente' }
  }
}

export async function renovarCookieGestao(estado: Extract<EstadoGestao, { estado: 'valida' }>) {
  if (estado.perfil === 'admin') {
    const token = await signToken({ adminId: estado.adminId, email: estado.email, nome: estado.nome })
    return setTokenCookie(token, 'navegador')
  }
  const token = await signPublicToken({
    userId: estado.payload.userId,
    email: estado.payload.email,
    nome: estado.payload.nome,
    tipo: 'organizador',
    status: estado.payload.status,
    trocarSenha: estado.payload.trocarSenha,
  })
  return setTokenCookie(token, 'navegador')
}
