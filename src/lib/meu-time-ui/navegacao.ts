// Endereços da área Meu Time. O convite do organizador chega como parâmetros de URL
// (categoria e limites) e precisa sobreviver entre a ficha do time e o assistente.

const PARAMETROS_CONVITE = ['categoria', 'convite', 'min', 'max', 'liberos', 'anoMin', 'anoMax'] as const

/** Token do link do organizador (`?convite=`), limpo; vazio ou grande demais vira undefined (o servidor aceita até 200). */
export function lerConvite(obter: (chave: string) => string | null | undefined): string | undefined {
  const bruto = obter('convite')?.trim()
  return bruto && bruto.length <= 200 ? bruto : undefined
}

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
