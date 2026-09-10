export const FASES_ELIMINATORIAS = ['NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS'] as const

export type FaseEliminatoria = typeof FASES_ELIMINATORIAS[number]

export const ELIMINATORY_TEAMS_BY_PHASE: Record<FaseEliminatoria, number> = {
  NENHUMA: 0,
  FINAL: 2,
  SEMIFINAL: 4,
  QUARTAS: 8,
  OITAVAS: 16,
  DEZESSEIS_AVOS: 32,
}

export function normalizeEliminatoryPhase(value?: string | null): FaseEliminatoria {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'FINAL') return 'FINAL'
  if (normalized === 'SEMIFINAL' || normalized === 'SEMIFINAIS') return 'SEMIFINAL'
  if (normalized === 'QUARTAS' || normalized === 'QUARTAS_DE_FINAL') return 'QUARTAS'
  if (normalized === 'OITAVAS' || normalized === 'OITAVAS_DE_FINAL') return 'OITAVAS'
  if (normalized === 'DEZESSEIS_AVOS' || normalized === 'DEZESSEIS_AVOS_DE_FINAL') return 'DEZESSEIS_AVOS'
  return 'NENHUMA'
}

export function getRequiredEliminatoryTeams(value?: string | null) {
  return ELIMINATORY_TEAMS_BY_PHASE[normalizeEliminatoryPhase(value)]
}

// Inverso de getRequiredEliminatoryTeams: de "quantos classificados" para
// "qual fase" — usado pelo wizard para calcular a fase eliminatória inicial
// automaticamente a partir dos classificados já definidos em Classificação
// (em vez de perguntar a fase de novo, de forma redundante). Retorna null
// quando a quantidade não forma uma chave eliminatória válida (não é
// potência de 2 entre 2 e 32) — o chamador decide como tratar esse caso.
export function getEliminatoryPhaseForTeams(quantidadeClassificados: number): FaseEliminatoria | null {
  const entry = (Object.entries(ELIMINATORY_TEAMS_BY_PHASE) as Array<[FaseEliminatoria, number]>).find(
    ([phase, count]) => phase !== 'NENHUMA' && count === quantidadeClassificados,
  )
  return entry ? entry[0] : null
}

export function formatEliminatoryPhase(value?: string | null) {
  const phase = normalizeEliminatoryPhase(value)
  const labels: Record<FaseEliminatoria, string> = {
    NENHUMA: 'Sem eliminatória',
    FINAL: 'Final',
    SEMIFINAL: 'Semifinal',
    QUARTAS: 'Quartas de final',
    OITAVAS: 'Oitavas de final',
    DEZESSEIS_AVOS: 'Dezesseis avos de final',
  }
  return labels[phase]
}
