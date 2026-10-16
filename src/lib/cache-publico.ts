/**
 * Cache compartilhado da CDN da Vercel para uma resposta idêntica
 * para todos os visitantes. A chave é a URL inteira, com a query.
 * Não usar quando a resposta ler cookie, sessão ou autorização.
 *
 * s-maxage=30: fresco no CDN por 30s. stale-while-revalidate=60: depois
 * disso, a CDN pode entregar a cópia por mais 60s enquanto revalida.
 * max-age=0: o navegador não guarda a resposta.
 */
export const CACHE_CONTROL_PUBLICO = 'public, max-age=0, s-maxage=30, stale-while-revalidate=60'

/** A CDN da Vercel não armazena resposta com private ou no-store. */
export const CACHE_CONTROL_PRIVADO = 'private, no-store'

export function comCachePublico<T extends Response>(resposta: T): T {
  resposta.headers.set('Cache-Control', CACHE_CONTROL_PUBLICO)
  return resposta
}

export function semCacheCompartilhado<T extends Response>(resposta: T): T {
  resposta.headers.set('Cache-Control', CACHE_CONTROL_PRIVADO)
  return resposta
}
