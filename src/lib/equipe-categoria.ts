// Rótulos em PT-BR para os enums reais de Equipe.categoria/serie (usados nos
// badges de categoria do card de campeonato e no filtro de /classificacao).
// Não confundir com Liga.categoriasConfig (taxonomia livre digitada pelo
// organizador, sem garantia de bater com equipes reais) — aqui a fonte é
// sempre o campo real da equipe.
export const CATEGORIA_LABELS: Record<string, string> = {
  FEMININO: 'Feminino',
  FEMININO_MASTER: 'Feminino Master',
  MASCULINO: 'Masculino',
  MASCULINO_MASTER: 'Masculino Master',
  MISTO: 'Misto',
}

export const SERIE_LABELS: Record<string, string> = {
  OURO: 'Ouro',
  PRATA: 'Prata',
}

export function formatCategoriaLabel(categoria: string, serie?: string | null): string {
  const categoriaLabel = CATEGORIA_LABELS[categoria] ?? categoria
  if (!serie) return categoriaLabel
  const serieLabel = SERIE_LABELS[serie] ?? serie
  return `${categoriaLabel} ${serieLabel}`
}
