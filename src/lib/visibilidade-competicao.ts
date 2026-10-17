import { supabaseAdmin } from '@/lib/supabase-admin'

// Competição privada (Liga.visibilidade = 'PRIVADA', migration pendente 202610170030).
// Privada: não aparece em lista pública, só por link/código, e exige convite para inscrever.
// Tolerância: sem a coluna (migration não aplicada) tudo é público, como antes.

export const VISIBILIDADES = ['PUBLICA', 'PRIVADA'] as const
export type VisibilidadeCompeticao = (typeof VISIBILIDADES)[number]

export function competicaoPrivada(liga: { visibilidade?: unknown } | null | undefined): boolean {
  return String(liga?.visibilidade ?? '').trim().toUpperCase() === 'PRIVADA'
}

/** Remove da lista as competições privadas. Linha sem o campo (coluna ausente) é pública. */
export function semPrivadas<T extends { visibilidade?: unknown }>(ligas: readonly T[] | null | undefined): T[] {
  return (ligas ?? []).filter((liga) => !competicaoPrivada(liga))
}

/** Remove da lista as competições cujo id está no conjunto de privadas. */
export function semIdsPrivados<T extends { id?: unknown }>(ligas: readonly T[] | null | undefined, privados: ReadonlySet<number>): T[] {
  return (ligas ?? []).filter((liga) => !privados.has(Number(liga.id)))
}

let cache: { ids: Set<number>; expira: number } | null = null

/**
 * Ids das competições privadas, em consulta separada para que a coluna ausente não
 * quebre a leitura principal: qualquer erro (coluna inexistente inclusive) vira conjunto vazio.
 * Cache curto, só para listas públicas; nunca usar para autorizar escrita.
 */
export async function idsCompeticoesPrivadas(opcoes: { semCache?: boolean } = {}): Promise<Set<number>> {
  if (!opcoes.semCache && cache && cache.expira > Date.now()) return cache.ids
  try {
    const { data, error } = await supabaseAdmin.from('Liga').select('id').eq('visibilidade', 'PRIVADA')
    if (error) return new Set()
    const ids = new Set<number>((data ?? []).map((linha: { id: number }) => Number(linha.id)))
    if (!opcoes.semCache) cache = { ids, expira: Date.now() + 30_000 }
    return ids
  } catch {
    return new Set()
  }
}

export function limparCacheCompeticoesPrivadas() {
  cache = null
}
