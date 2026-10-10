export function escalacaoParaJogo(salva: string[] | null | undefined, padrao: string[], preJogo: boolean) {
  if (preJogo) return Array.from({ length: 6 }, () => '')
  if (salva?.some((item) => String(item ?? '').trim())) {
    const base = salva.map((item) => String(item ?? ''))
    while (base.length < 6) base.push('')
    return base.slice(0, 6)
  }
  const numeros = padrao.map((item) => String(item ?? '')).slice(0, 6)
  while (numeros.length < 6) numeros.push('')
  return numeros
}
