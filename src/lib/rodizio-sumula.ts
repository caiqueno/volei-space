/**
 * Alerta de rodízio. Só deve ser chamado quando o campeonato ligou a opção.
 * Compara a quadra atual com a do ponto anterior e aceita substituição:
 * quem permaneceu precisa continuar na mesma ordem.
 */
export function mensagemRodizioIlegal(anterior: string[], atual: string[]): string | null {
  if (anterior.length < 6 || atual.length < 6) return null
  const permanecem = atual.filter((numero) => numero && anterior.includes(numero))
  const ordemAnterior = anterior.filter((numero) => numero && permanecem.includes(numero))
  if (permanecem.join('|') === ordemAnterior.join('|')) return null
  return 'Rodízio diferente do esperado. Confira a ordem da quadra.'
}

export function colunaDeAlertaRodizioAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /alertaRodizioIlegal/i.test(texto)
}

export function semAlertaRodizio<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.alertaRodizioIlegal
  return saida
}

export function soAlertaRodizio(patch: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(patch, 'alertaRodizioIlegal')) return {}
  return { alertaRodizioIlegal: patch.alertaRodizioIlegal === true }
}
