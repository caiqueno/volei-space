export type CategoriaResumo = { id: string; statusConfiguracao: string }

export const SECOES_DA_CATEGORIA = ['estrutura', 'classificacao', 'eliminatorias', 'calendario', 'inscricoes'] as const

export function secaoExigeCategoria(secao: string) {
  return (SECOES_DA_CATEGORIA as readonly string[]).includes(secao)
}

export function chaveCategoriaAtiva(ligaId: number) {
  return `volei.categoriaAtiva.${ligaId}`
}

/** Pendente primeiro. Se a última trabalhada ainda estiver pendente, ela abre. Se todas estiverem concluídas, reabre a última ou a primeira. */
export function categoriaParaAbrir(categorias: CategoriaResumo[], ultimaId: string | null) {
  if (!categorias.length) return null
  const pendentes = categorias.filter((categoria) => categoria.statusConfiguracao !== 'CONCLUIDA')
  if (pendentes.length) return pendentes.find((categoria) => categoria.id === ultimaId)?.id ?? pendentes[0].id
  return categorias.find((categoria) => categoria.id === ultimaId)?.id ?? categorias[0].id
}
