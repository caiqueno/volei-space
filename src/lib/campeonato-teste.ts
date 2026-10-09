type LigaTeste = {
  descricao?: string | null
  slug?: string | null
  nome?: string | null
  simulacao?: boolean | null
}

const MARCADORES = [
  'VOLEI_SPACE_TEST_SEED',
  'VOLEI_SPACE_ORG_ISOLAMENTO',
  'TOURNAMENT-SEED-2026',
]

export function campeonatoDeTeste(liga: LigaTeste | LigaTeste[] | null | undefined) {
  const item = Array.isArray(liga) ? liga[0] : liga
  if (!item) return false
  if (item.simulacao) return true
  const texto = `${item.descricao ?? ''}\n${item.slug ?? ''}\n${item.nome ?? ''}`
  if (MARCADORES.some((marcador) => texto.includes(marcador))) return true
  const slug = item.slug ?? ''
  const nome = item.nome ?? ''
  return slug.startsWith('seed-2026-') || slug.startsWith('org-marcos-') || slug.startsWith('org-antonio-') || nome.startsWith('SEED-CHAMP')
}
