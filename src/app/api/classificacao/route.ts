import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const ligaId = searchParams.get('ligaId')
    const ligaIds = (searchParams.get('ligaIds') ?? '')
      .split(',')
      .map((valor) => Number(valor))
      .filter((valor) => Number.isInteger(valor) && valor > 0)
      .slice(0, 40)

    const { data: simuladas } = await supabase.from('Liga').select('id').eq('simulacao', true)
    const simulacaoIds = (simuladas ?? []).map((liga) => liga.id)

    let q = supabase
      .from('ClassificacaoEntrada')
      .select('*, equipe:Equipe(*)')
      .order('posicao', { ascending: true })

    if (ligaIds.length) q = q.in('ligaId', ligaIds)
    else if (ligaId) q = q.eq('ligaId', Number(ligaId))
    if (simulacaoIds.length) q = q.not('ligaId', 'in', `(${simulacaoIds.join(',')})`)
    if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    if (categoria) q = q.eq('categoria', categoria)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar classificação', 500)
  }
}
