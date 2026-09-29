/**
 * Escopo da categoria gravada no campeonato.
 * Garante que o id pertence ao `ligaId` antes de ler a configuração.
 * O seletor em `brain/04 - Plataforma e AppWeb/Seletor de Categoria.md` usa
 * `cat` e `serie` na URL; `categoryScopeFromUrl` recusa o parâmetro `serie`.
 */
import { z } from 'zod'
import { supabaseAdmin as db } from '@/lib/supabase-admin'

export const categoryIdSchema = z.string().uuid()

/** Erro de escopo com status HTTP. Não há nota específica no `/brain`; carrega as recusas das funções abaixo. */
export class CategoryScopeError extends Error {
  constructor(message: string, public readonly status = 422) { super(message) }
}

/**
 * Confere se a categoria existe neste campeonato.
 * @param ligaId identificador do campeonato; inteiro positivo
 * @param categoryId id da categoria; precisa ser UUID
 * @returns linha de `CategoriaCampeonato` (`id`, `ligaId`, `codigo`, `nome`, `versao`, `revisaoOperacional`, `statusConfiguracao`)
 * Efeito: leitura em `CategoriaCampeonato`. Lança `CategoryScopeError` (422, 404 ou 503).
 * `brain/04 - Plataforma e AppWeb/Seletor de Categoria.md` pede dados independentes por categoria,
 * identificados lá por `cat` e `serie`, e aqui por UUID ligado ao campeonato.
 */
export async function requireCategoryScope(ligaId: number, categoryId: unknown) {
  if (!Number.isSafeInteger(ligaId) || ligaId <= 0) throw new CategoryScopeError('Selecione um campeonato válido.')
  const parsed = categoryIdSchema.safeParse(categoryId)
  if (!parsed.success) throw new CategoryScopeError('Selecione uma categoria do campeonato.')
  const { data, error } = await db.from('CategoriaCampeonato').select('*')
    .eq('id', parsed.data).eq('ligaId', ligaId).maybeSingle()
  if (error) throw new CategoryScopeError('Não foi possível consultar a categoria.', 503)
  if (!data || data.removidaEm) throw new CategoryScopeError('Categoria não encontrada neste campeonato.', 404)
  return data as { id: string; ligaId: number; codigo: string; nome: string; versao: number; revisaoOperacional: number; statusConfiguracao: string }
}

/**
 * Lê a configuração depois de passar por `requireCategoryScope`.
 * @param ligaId campeonato
 * @param categoryId UUID da categoria
 * @returns linha de `CategoriaConfiguracao`
 * Efeito: duas leituras. Ausência ou erro de configuração vira 409.
 * Gap: o `/brain` não documenta a tabela `CategoriaConfiguracao`.
 */
export async function getCategoryConfiguration(ligaId: number, categoryId: string) {
  await requireCategoryScope(ligaId, categoryId)
  const { data, error } = await db.from('CategoriaConfiguracao').select('*')
    .eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoryId).single()
  if (error || !data) throw new CategoryScopeError('Configuração da categoria indisponível.', 409)
  return data as Record<string, any>
}

/**
 * Configuração da categoria à qual a partida está vinculada.
 * @param partida precisa trazer `ligaId` e `categoriaCampeonatoId`
 * @returns o mesmo que `getCategoryConfiguration`
 * Sem `categoriaCampeonatoId`, lança 409.
 * `brain/11 - Desenvolvimento/Briefing Técnico - Súmula Digital.md` pede partida cadastrada;
 * a categoria persistida é extensão que o `/brain` não descreve.
 */
export async function getMatchCategoryConfiguration(partida: { ligaId: number; categoriaCampeonatoId?: string | null }) {
  if (!partida.categoriaCampeonatoId) throw new CategoryScopeError('Partida ainda não vinculada a uma categoria. Revise a migração.', 409)
  return getCategoryConfiguration(partida.ligaId, partida.categoriaCampeonatoId)
}

/**
 * Extrai `ligaId` e `categoriaCampeonatoId` da query.
 * @param url URL completa da requisição
 * @returns os dois valores; `ligaId` não é validado aqui
 * Efeito: nenhum I/O. Lança se a query tiver `serie` ou `categoria`.
 * Diverge de `brain/04 - Plataforma e AppWeb/Seletor de Categoria.md`, que propaga `serie` na navegação.
 */
export function categoryScopeFromUrl(url: string) {
  const params = new URL(url).searchParams
  if (params.has('serie') || params.has('categoria')) throw new CategoryScopeError('Use a categoria persistida do campeonato.')
  return { ligaId: Number(params.get('ligaId')), categoriaCampeonatoId: params.get('categoriaCampeonatoId') }
}
