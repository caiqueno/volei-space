import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const ligaId = Number(searchParams.get('ligaId'))
    if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)

    let q = supabase
      .from('ClassificacaoEntrada')
      .select('*, equipe:Equipe(*)')
      .eq('ligaId', ligaId)
      .order('posicao', { ascending: true })
      .limit(80)
    if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    if (categoria) q = q.eq('categoria', categoria)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar classificação', 500)
  }
}
