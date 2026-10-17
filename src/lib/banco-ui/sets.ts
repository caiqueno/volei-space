/** Escolha do set da papeleta. Módulo PURO. */
import type { PapeletaBanco } from './tipos'

export const MAX_SETS = 5

/** Sets exibidos: os que já têm papeleta mais o próximo (até o máximo de sets). */
export function setsDisponiveis(papeletas: readonly PapeletaBanco[]): number[] {
  const existentes = Array.from(new Set(papeletas.map((p) => p.setNumero))).sort((a, b) => a - b)
  const proximo = (existentes[existentes.length - 1] ?? 0) + 1
  if (proximo <= MAX_SETS) existentes.push(proximo)
  return existentes
}

/** Set aberto por padrão: o primeiro cuja papeleta ainda não foi aceita (ou o próximo, se todas foram). */
export function setPadrao(papeletas: readonly PapeletaBanco[]): number {
  const sets = setsDisponiveis(papeletas)
  const pendente = sets.find((s) => papeletas.find((p) => p.setNumero === s)?.estado !== 'ACEITA')
  return pendente ?? sets[sets.length - 1] ?? 1
}
