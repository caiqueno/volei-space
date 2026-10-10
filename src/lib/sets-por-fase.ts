/**
 * Quantidade de sets da fase. Null ou ausente herda `setsPorPartida` do campeonato.
 * Vale para final, semifinal e disputa de 3º lugar. As outras fases usam o padrão.
 */
export type SetsPorFase = {
  setsPorPartida?: number | null
  setsPorPartidaFinal?: number | null
  setsPorPartidaSemifinal?: number | null
  setsPorPartidaTerceiroLugar?: number | null
}

export const CAMPOS_SETS_POR_FASE = ['setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaTerceiroLugar'] as const

const FASE_DO_CAMPO: Record<(typeof CAMPOS_SETS_POR_FASE)[number], string> = {
  setsPorPartidaFinal: 'FINAL',
  setsPorPartidaSemifinal: 'SEMIFINAL',
  setsPorPartidaTerceiroLugar: 'TERCEIRO_LUGAR',
}

export function inteiroDeSets(valor: unknown): number | null {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) return null
  return numero
}

export function setsDaFase(regras: SetsPorFase | null | undefined, fase?: string | null): number {
  const base = inteiroDeSets(regras?.setsPorPartida) ?? 3
  const faseNorm = String(fase ?? '').trim().toUpperCase()
  const campo = (Object.entries(FASE_DO_CAMPO).find(([, nome]) => nome === faseNorm)?.[0] ?? null) as keyof SetsPorFase | null
  if (!campo) return base
  return inteiroDeSets(regras?.[campo]) ?? base
}

export function rotuloSetsDaFase(especifico: number | null | undefined, padrao: number | null | undefined) {
  const base = inteiroDeSets(padrao) ?? 3
  const proprio = inteiroDeSets(especifico)
  if (proprio == null) return `Igual ao campeonato (melhor de ${base})`
  return `Melhor de ${proprio}`
}
