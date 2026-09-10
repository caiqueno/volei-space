import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoria = searchParams.get('categoria')
    const serie = searchParams.get('serie')

    let q = supabase
      .from('VotoMVP')
      .select('jogadorId, jogador:Jogador(*, equipe:Equipe(nome, corHex))')

    if (categoria) q = q.eq('categoria', categoria)
    if (serie) q = q.eq('serie', serie)

    const { data, error: err } = await q
    if (err) throw err

    // Aggregate votes
    const voteCounts: Record<number, { jogador: any; votos: number }> = {}
    for (const row of data ?? []) {
      const id = row.jogadorId
      if (!voteCounts[id]) voteCounts[id] = { jogador: row.jogador, votos: 0 }
      voteCounts[id].votos++
    }

    const ranking = Object.values(voteCounts).sort((a, b) => b.votos - a.votos)
    return success(ranking)
  } catch {
    return error('Erro ao buscar rankings', 500)
  }
}
