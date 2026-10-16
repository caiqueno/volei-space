import { colunaAusente, type ErroDeColuna } from '@/lib/coluna-ausente'

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

export function colunaDeAlertaRodizioAusente(erro: ErroDeColuna) {
  return colunaAusente(erro, ['alertaRodizioIlegal'])
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
