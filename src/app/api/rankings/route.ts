import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')

    let q = supabase
      .from('VotoMVP')
      .select('jogadorId, jogador:Jogador(*, equipe:Equipe(nome, corHex, categoriaCampeonatoId))')

    if (!categoriaCampeonatoId && categoria) q = q.eq('categoria', categoria)

    const { data, error: err } = await q
    if (err) throw err

    // Aggregate votes
    const voteCounts: Record<number, { jogador: any; votos: number }> = {}
    const linhas = (data ?? []).filter((row: any) => {
      if (!categoriaCampeonatoId) return true
      const jogador = Array.isArray(row.jogador) ? row.jogador[0] : row.jogador
      const equipe = Array.isArray(jogador?.equipe) ? jogador.equipe[0] : jogador?.equipe
      return equipe?.categoriaCampeonatoId === categoriaCampeonatoId
    })
    for (const row of linhas) {
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
