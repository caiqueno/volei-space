export function escalacaoVazia() {
  return Array.from({ length: 6 }, () => '')
}

/** Sem formação gravada, a papeleta abre vazia. O elenco não entra nas seis posições. */
export function escalacaoParaJogo(salva: string[] | null | undefined, _padrao: readonly string[] = [], _preJogo = false) {
  if (salva?.some((item) => String(item ?? '').trim())) {
    const base = salva.map((item) => String(item ?? ''))
    while (base.length < 6) base.push('')
    return base.slice(0, 6)
  }
  return escalacaoVazia()
}

export function atletaRepetidoNaPapeleta(escalacao: readonly string[], indice: number, numero: string) {
  const alvo = String(numero ?? '').trim()
  if (!alvo) return false
  return escalacao.some((item, index) => index !== indice && String(item) === alvo)
}

export function papeletaCompleta(escalacao: readonly string[]) {
  const preenchidas = escalacao.map((item) => String(item ?? '').trim()).filter(Boolean)
  return preenchidas.length === 6 && new Set(preenchidas).size === 6
}
