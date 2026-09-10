import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoria = searchParams.get('categoria')
    const serie = searchParams.get('serie')
    const ligaId = searchParams.get('ligaId')

    let q = supabase
      .from('ClassificacaoEntrada')
      .select('*, equipe:Equipe(*)')
      .order('posicao', { ascending: true })

    if (ligaId) q = q.eq('ligaId', Number(ligaId))
    if (categoria) q = q.eq('categoria', categoria)
    if (serie) q = q.eq('serie', serie)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar classificação', 500)
  }
}
