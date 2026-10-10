import { TOKEN_AUD, TOKEN_TYP } from '@/lib/token-claims'

type AdminSession = {
  adminId?: unknown
  email?: unknown
  scope?: unknown
  purpose?: unknown
  typ?: unknown
  aud?: unknown
}

export const ADMIN_SESSION_SCOPE = 'admin'

export function configuredAdminEmail() {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return value || null
}

// Produção e preview da Vercel precisam da lista fechada. Sem a variável,
// qualquer JWT com adminId viraria sessão. No `next dev` local a tabela Admin
// continua valendo, como decidido em 29/09/2026.
export function ambienteExigeEmailDeAdmin() {
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') return true
  return process.env.NODE_ENV === 'production'
}

export function adminEmailAllowed(email: string) {
  const configured = configuredAdminEmail()
  if (!configured) return !ambienteExigeEmailDeAdmin()
  return email.trim().toLowerCase() === configured
}

function audienciaAdmin(aud: unknown) {
  if (aud === TOKEN_AUD.admin) return true
  return Array.isArray(aud) && aud.length === 1 && aud[0] === TOKEN_AUD.admin
}

export function isAdminSession(payload: object) {
  const session = payload as AdminSession
  if (session.purpose != null && String(session.purpose).trim() !== '') return false
  if (session.scope != null && session.scope !== ADMIN_SESSION_SCOPE) return false
  if (session.typ !== TOKEN_TYP.admin) return false
  if (!audienciaAdmin(session.aud)) return false
  if (session.adminId == null || session.adminId === '') return false
  return adminEmailAllowed(String(session.email ?? ''))
}
