export const TEXTO_AGUARDANDO_OFICIALIZACAO = 'Partida encerrada aguardando oficialização da súmula.'

export function normalizarTextoSumula(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function descricaoAguardandoOficializacao(descricao: string) {
  return normalizarTextoSumula(descricao).includes('aguardando oficializacao da sumula')
}

export function partidaEncerradaNaSessao(status: string, ocorrencias: Array<{ descricao?: string | null }>) {
  const normalizado = normalizarTextoSumula(status).replace(/_/g, ' ')
  if (['encerrada', 'finalizada', 'finished'].includes(normalizado)) return true
  return ocorrencias.some((item) => descricaoAguardandoOficializacao(String(item.descricao ?? '')))
}

export function confirmarPapeletas(
  ocorrencias: Array<{ descricao?: string | null; set?: number | null }>,
  equipeA: string,
  equipeB: string,
  setAtual: number,
) {
  const result = { teamA: false, teamB: false }
  const nomeA = normalizarTextoSumula(equipeA)
  const nomeB = normalizarTextoSumula(equipeB)
  for (const item of ocorrencias) {
    if (Number(item.set ?? setAtual) !== setAtual) continue
    const text = normalizarTextoSumula(String(item.descricao ?? ''))
    if (!text.includes('escalacao') || !text.includes('conferida')) continue
    if (nomeA && text.includes(nomeA)) result.teamA = true
    if (nomeB && text.includes(nomeB)) result.teamB = true
  }
  return result
}

export function ocorrenciaOperacional(item: { tipo?: string | null; descricao?: string | null }) {
  if (normalizarTextoSumula(String(item.tipo ?? '')).replace(/_/g, ' ') === 'system') return true
  return String(item.descricao ?? '').startsWith('Registro de ')
}
