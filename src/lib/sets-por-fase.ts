/**
 * Quantidade de sets da fase. Null ou ausente herda `setsPorPartida` do campeonato.
 * Vale para final, semifinal, quartas, oitavas e disputa de 3º lugar.
 * Dezesseis avos e grupos continuam no padrão do campeonato.
 */
export type SetsPorFase = {
  setsPorPartida?: number | null
  setsPorPartidaFinal?: number | null
  setsPorPartidaSemifinal?: number | null
  setsPorPartidaQuartas?: number | null
  setsPorPartidaOitavas?: number | null
  setsPorPartidaTerceiroLugar?: number | null
}

/** Colunas que a súmula já lia antes de quartas e oitavas. A leitura nova não pode derrubar estas. */
export const CAMPOS_SETS_POR_FASE_ANTERIORES = ['setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaTerceiroLugar'] as const

export const CAMPOS_SETS_QUARTAS_OITAVAS = ['setsPorPartidaQuartas', 'setsPorPartidaOitavas'] as const

export const CAMPOS_SETS_POR_FASE = [...CAMPOS_SETS_POR_FASE_ANTERIORES, ...CAMPOS_SETS_QUARTAS_OITAVAS] as const

const FASE_DO_CAMPO: Record<(typeof CAMPOS_SETS_POR_FASE)[number], string> = {
  setsPorPartidaFinal: 'FINAL',
  setsPorPartidaSemifinal: 'SEMIFINAL',
  setsPorPartidaQuartas: 'QUARTAS',
  setsPorPartidaOitavas: 'OITAVAS',
  setsPorPartidaTerceiroLugar: 'TERCEIRO_LUGAR',
}

export function colunaDeSetsQuartasOitavasAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /setsPorPartidaQuartas|setsPorPartidaOitavas/i.test(texto)
}

export function semSetsQuartasOitavas<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.setsPorPartidaQuartas
  delete saida.setsPorPartidaOitavas
  return saida
}

export function soSetsQuartasOitavas(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  for (const chave of CAMPOS_SETS_QUARTAS_OITAVAS) {
    if (Object.prototype.hasOwnProperty.call(patch, chave)) saida[chave] = patch[chave]
  }
  return saida
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
