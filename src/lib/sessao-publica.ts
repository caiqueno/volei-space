export type SessaoPublica = {
  tipo?: string
  trocarSenha?: boolean
  nome?: string
  email?: string
  candidaturaId?: string | null
  status?: string
  perfil?: string
}

export function lerSessaoPublica(): SessaoPublica | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null') as SessaoPublica | null
    if (!stored || typeof stored !== 'object' || !stored.tipo) return null
    return stored
  } catch {
    return null
  }
}

export async function encerrarSessaoPublica() {
  try {
    window.localStorage.removeItem('luva_session')
  } catch {
    // A sessão local já está ilegível.
  }
  try {
    await fetch('/api/auth', { method: 'DELETE' })
  } catch {
    // O cookie expira sozinho se a rede falhar; a sessão local já saiu.
  }
  window.location.replace('/login')
}
