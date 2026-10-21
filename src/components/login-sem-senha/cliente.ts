// Porta de conversa do login sem senha. Envelope `{data}` / `{error, codigo?}`.
// 404 = login sem senha desligado no servidor; 503 = não habilitado.
import { lerConfirmar, lerPerfis, mensagemErro, type Canal, type Perfil, type ResultadoConfirmar } from '@/lib/login-sem-senha-ui/regras'

export type Resposta<T> = { ok: true; dados: T } | { ok: false; status: number; mensagem: string }

async function chamar(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<{ status: number; json: unknown }> {
  try {
    const res = await fetch(caminho, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const json: unknown = await res.json().catch(() => null)
    return { status: res.status, json }
  } catch {
    return { status: 0, json: null }
  }
}

function falha(status: number, json: unknown, contexto: 'solicitar' | 'confirmar' | 'perfil'): { ok: false; status: number; mensagem: string } {
  const o = json && typeof json === 'object' ? (json as { error?: unknown; codigo?: unknown }) : {}
  const codigo = typeof o.codigo === 'string' ? o.codigo : undefined
  const servidor = typeof o.error === 'string' ? o.error : undefined
  return { ok: false, status, mensagem: mensagemErro(status, codigo, contexto, servidor) }
}

export async function solicitarCodigo(dados: { email: string; canal?: Canal; telefone?: string }): Promise<Resposta<true>> {
  const r = await chamar('POST', '/api/auth/codigo/solicitar', dados)
  // 202 uniforme: o servidor nunca diz se o e-mail existe.
  return r.status === 202 || r.status === 200 ? { ok: true, dados: true } : falha(r.status, r.json, 'solicitar')
}

export async function confirmarCodigo(email: string, codigo: string): Promise<Resposta<ResultadoConfirmar>> {
  const r = await chamar('POST', '/api/auth/codigo/confirmar', { email, codigo })
  if (r.status < 200 || r.status >= 300) return falha(r.status, r.json, 'confirmar')
  const lido = lerConfirmar(r.json)
  return lido ? { ok: true, dados: lido } : falha(500, null, 'confirmar')
}

export async function trocarPerfil(perfil: Pick<Perfil, 'perfil' | 'referenciaId'>): Promise<Resposta<true>> {
  const r = await chamar('POST', '/api/auth/perfil/trocar', { perfil: perfil.perfil, referenciaId: perfil.referenciaId })
  return r.status >= 200 && r.status < 300 ? { ok: true, dados: true } : falha(r.status, r.json, 'perfil')
}

export async function listarPerfis(): Promise<Resposta<{ perfis: Perfil[]; perfilAtivo: Perfil | null }>> {
  const r = await chamar('GET', '/api/auth/perfis')
  if (r.status < 200 || r.status >= 300) return falha(r.status, r.json, 'perfil')
  const lido = lerPerfis(r.json)
  return lido ? { ok: true, dados: lido } : { ok: true, dados: { perfis: [], perfilAtivo: null } }
}
