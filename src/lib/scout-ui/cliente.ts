/** Chamadas do scout ao servidor. O link (token) é a credencial. */
export interface RespostaScout {
  ok: boolean
  /** null = falha de rede. */
  status: number | null
  json: unknown
}

export async function chamarApi(caminho: string, metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', corpo?: unknown): Promise<RespostaScout> {
  try {
    const res = await fetch(caminho, {
      method: metodo,
      cache: 'no-store',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const json: unknown = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  } catch {
    return { ok: false, status: null, json: null }
  }
}

export const caminhoScout = (token: string, resto = '') => `/api/scout/${encodeURIComponent(token)}${resto}`
export const caminhoSumula = (token: string) => `/api/sumula/${encodeURIComponent(token)}`
