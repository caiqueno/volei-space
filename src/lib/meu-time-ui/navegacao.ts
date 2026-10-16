// Endereços da área Meu Time. O convite do organizador chega como parâmetros de URL
// (categoria e limites) e precisa sobreviver entre a ficha do time e o assistente.

const PARAMETROS_CONVITE = ['categoria', 'min', 'max', 'liberos', 'anoMin', 'anoMax'] as const

export function hrefInscricao(equipeId: string, obter: (chave: string) => string | null | undefined): string | undefined {
  const categoria = obter('categoria')
  if (!categoria) return undefined
  const params = new URLSearchParams()
  for (const chave of PARAMETROS_CONVITE) {
    const valor = obter(chave)
    if (valor) params.set(chave, valor)
  }
  return `/meu-time/${encodeURIComponent(equipeId)}/inscrever?${params.toString()}`
}
