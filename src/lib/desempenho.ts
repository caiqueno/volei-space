export const LIMIAR_INDICADOR_MS = 5000
export const TIMEOUT_CONSULTA_MS = 20000
export const CACHE_CONSULTA_MS = 20000

export type EstadoConsulta = 'idle' | 'loading' | 'success' | 'error' | 'refetching'

export function deveExibirIndicador(inicioMs: number, agoraMs: number, limiarMs = LIMIAR_INDICADOR_MS) {
  return agoraMs - inicioMs >= limiarMs
}

export function caminhoConsulta(url: string) {
  try {
    const endereco = new URL(url, 'http://local')
    return endereco.pathname
  } catch {
    return url.split('?')[0] || url
  }
}
