import { TOKEN_AUD, TOKEN_TYP } from '@/lib/token-claims'

type AdminSession = {
  adminId?: unknown
  email?: unknown
  scope?: unknown
  purpose?: unknown
  typ?: unknown
  aud?: unknown
}

export function configuredAdminEmail() {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return value || null
}

export function adminEmailAllowed(email: string) {
  const configured = configuredAdminEmail()
  if (!configured) return false
  return email.trim().toLowerCase() === configured
}

function audienciaAdmin(aud: unknown) {
  if (aud === TOKEN_AUD.admin) return true
  return Array.isArray(aud) && aud.length === 1 && aud[0] === TOKEN_AUD.admin
}

export function isAdminSession(payload: object) {
  const session = payload as AdminSession
  if (session.scope === 'public-user') return false
  if (session.purpose) return false
  if (session.typ !== TOKEN_TYP.admin) return false
  if (!audienciaAdmin(session.aud)) return false
  if (session.adminId == null || session.adminId === '') return false
  return adminEmailAllowed(String(session.email ?? ''))
}
