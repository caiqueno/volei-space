import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { numeroDeRanking } from '@/lib/classificacao-jogadores'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { lerTodasAsLinhas } from '@/lib/leitura-paginada'

const JOGADOR_COLUNAS = 'id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipeId'
const VOTO_COLUNAS = 'jogadorId,categoria,categoriaCampeonatoId'
const EQUIPE_COLUNAS = 'id,nome,corHex,categoriaCampeonatoId'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = categoriaDaUrl(searchParams)
    if ('erro' in categoria) return error(categoria.erro, 422)
    const categoriaCampeonatoId = categoria.id

    const votos = await lerTodasAsLinhas<{ jogadorId: number; categoria: string; categoriaCampeonatoId: string }>(() => {
      let votosQuery = supabase.from('VotoMVP').select(VOTO_COLUNAS)
      if (categoriaCampeonatoId) votosQuery = votosQuery.eq('categoriaCampeonatoId', categoriaCampeonatoId)
      return votosQuery
    })

    const jogadorIds = Array.from(new Set(votos.map((voto) => Number(voto.jogadorId)).filter((id) => Number.isInteger(id))))
    if (jogadorIds.length === 0) return success([])

    const jogadores = await lerTodasAsLinhas(() => supabase
      .from('Jogador')
      .select(JOGADOR_COLUNAS)
      .in('id', jogadorIds))

    const equipeIds = Array.from(new Set(jogadores.map((jogador) => Number(jogador.equipeId)).filter((id) => Number.isInteger(id))))
    const equipes = equipeIds.length
      ? await lerTodasAsLinhas(() => supabase.from('Equipe').select(EQUIPE_COLUNAS).in('id', equipeIds))
      : []

    const equipePorId = new Map(equipes.map((equipe) => [equipe.id, equipe]))
    const jogadorPorId = new Map(jogadores.map((jogador) => {
      const equipe = equipePorId.get(jogador.equipeId) ?? null
      return [jogador.id, {
        id: jogador.id,
        nome: jogador.nome,
        numero: numeroDeRanking(jogador.numero),
        posicao: jogador.posicao,
        fotoUrl: jogador.fotoUrl,
        fotoRostoUrl: jogador.fotoRostoUrl,
        equipe: equipe
          ? { nome: equipe.nome, corHex: equipe.corHex, categoriaCampeonatoId: equipe.categoriaCampeonatoId }
          : null,
      }]
    }))

    const voteCounts = new Map<number, { jogador: NonNullable<ReturnType<typeof jogadorPorId.get>>; votos: number }>()
    for (const voto of votos) {
      const jogador = jogadorPorId.get(Number(voto.jogadorId))
      if (!jogador) continue
      if (categoriaCampeonatoId && jogador.equipe?.categoriaCampeonatoId !== categoriaCampeonatoId) continue
      const atual = voteCounts.get(jogador.id) ?? { jogador, votos: 0 }
      atual.votos += 1
      voteCounts.set(jogador.id, atual)
    }

    const ranking = Array.from(voteCounts.values()).sort((a, b) => b.votos - a.votos)
    return success(ranking)
  } catch (err) {
    console.error('[rankings] erro ao buscar', err)
    return error('Erro ao buscar rankings', 500)
  }
}
