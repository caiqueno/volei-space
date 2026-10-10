import { supabaseAdmin } from '@/lib/supabase-admin'

export type CategoriaDoCampeonato = { id: string; nome: string }

export async function listarCategoriasDoCampeonato(ligaId: number) {
  const { data, error } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id,nome,ordem')
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
    .order('ordem', { ascending: true })
  if (error) return { erro: true as const, categorias: [] as CategoriaDoCampeonato[] }
  return {
    erro: false as const,
    categorias: (data ?? []).map((categoria) => ({ id: String(categoria.id), nome: String(categoria.nome) })),
  }
}
