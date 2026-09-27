export const MISSING_FIELD_ANCHOR: Record<string, string> = {
  nome: 'nome-campeonato',
  formato: 'formato-competicao',
  quantidadeEquipes: 'quantidade-equipes',
  criteriosClassificacao: 'criterios-classificacao',
  faseEliminatoria: 'fase-eliminatoria',
  dataInicio: 'data-inicio',
  dataFim: 'data-fim',
  formularioInscricaoConfig: 'formulario-inscricao',
}

export function revealMissingFields(
  fields: string[],
  steps: Record<string, number>,
  setStepIndex: (index: number) => void,
  setVisited: (update: (current: Set<number>) => Set<number>) => void,
) {
  const indexes = fields
    .map((field) => steps[field])
    .filter((index): index is number => typeof index === 'number')
  if (indexes.length > 0) {
    const step = Math.min(...indexes)
    setStepIndex(step)
    setVisited((current) => new Set(current).add(step))
  }

  const anchor = fields.map((field) => MISSING_FIELD_ANCHOR[field]).find(Boolean)
  if (!anchor) return
  window.setTimeout(() => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 60)
}
