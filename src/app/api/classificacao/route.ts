import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const ligaId = Number(searchParams.get('ligaId'))
    if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)

    let q = supabaseAdmin
      .from('ClassificacaoEntrada')
      .select('*, equipe:Equipe(*)')
      .eq('ligaId', ligaId)
      .order('posicao', { ascending: true })
      .limit(80)
    let equipes = supabaseAdmin
      .from('Equipe')
      .select('id,nome,corHex,logoUrl,categoria,categoriaCampeonatoId')
      .eq('ligaId', ligaId)
      .eq('statusEquipe', 'ATIVA')
      .order('nome', { ascending: true })
    if (categoriaCampeonatoId) {
      q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
      equipes = equipes.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    }
    if (categoria) {
      q = q.eq('categoria', categoria)
      equipes = equipes.eq('categoria', categoria)
    }

    const [{ data, error: err }, equipesResposta] = await Promise.all([q, equipes])
    if (err) throw err
    const linhas = [...(data ?? [])]
    const presentes = new Set(linhas.map((linha) => Number(linha.equipeId)))
    let proxima = linhas.reduce((maior, linha) => Math.max(maior, Number(linha.posicao ?? 0)), 0)
    for (const equipe of equipesResposta.data ?? []) {
      if (presentes.has(equipe.id)) continue
      proxima += 1
      linhas.push({
        posicao: proxima,
        pontos: 0,
        jogos: 0,
        vitorias: 0,
        derrotas: 0,
        setsPro: 0,
        setsContra: 0,
        pontosPro: 0,
        pontosContra: 0,
        punicoes: 0,
        equipeId: equipe.id,
        ligaId,
        equipe,
      })
    }
    const resposta = success(linhas)
    resposta.headers.set('Cache-Control', 'no-store')
    return resposta
  } catch {
    return error('Erro ao buscar classificação', 500)
  }
}
