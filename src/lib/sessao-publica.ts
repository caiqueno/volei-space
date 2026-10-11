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
  await limparSessaoLocal('/api/auth')
  window.location.replace('/login')
}

export async function encerrarSessaoPorInatividade() {
  await limparSessaoLocal('/api/auth?gestao=1')
  window.location.replace('/login?sessao=expirada')
}

async function limparSessaoLocal(caminho: string) {
  try {
    window.localStorage.removeItem('luva_session')
  } catch {
    // A sessão local já está ilegível.
  }
  try {
    await fetch(caminho, { method: 'DELETE' })
  } catch {
    // O cookie expira sozinho se a rede falhar; a sessão local já saiu.
  }
}
