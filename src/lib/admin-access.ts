type AdminSession = {
  adminId?: unknown
  email?: unknown
  scope?: unknown
}

export function configuredAdminEmail() {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return value || null
}

export function adminEmailAllowed(email: string) {
  const configured = configuredAdminEmail()
  if (!configured) return true
  return email.trim().toLowerCase() === configured
}

export function isAdminSession(payload: AdminSession) {
  if (payload.scope === 'public-user') return false
  if (payload.adminId == null || payload.adminId === '') return false
  return adminEmailAllowed(String(payload.email ?? ''))
}
