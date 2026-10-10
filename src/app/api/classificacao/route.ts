import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const categoria = categoriaDaUrl(searchParams)
    if ('erro' in categoria) return error(categoria.erro, 422)
    const ligaId = Number(searchParams.get('ligaId'))
    if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)

    const colunas = 'id,equipeId,ligaId,categoriaCampeonatoId,categoria,serie,posicao,pontos,jogos,vitorias,derrotas,setsPro,setsContra,pontosPro,pontosContra,punicoes,atualizadoEm'
    let q = supabaseAdmin
      .from('ClassificacaoEntrada')
      .select(`${colunas}, equipe:Equipe(id,nome,corHex,logoUrl,categoria,categoriaCampeonatoId,slug)`)
      .eq('ligaId', ligaId)
      .order('posicao', { ascending: true })
      .limit(80)
    let equipes = supabaseAdmin
      .from('Equipe')
      .select('id,nome,corHex,logoUrl,categoria,categoriaCampeonatoId')
      .eq('ligaId', ligaId)
      .eq('statusEquipe', 'ATIVA')
      .order('nome', { ascending: true })
    if (categoria.id) {
      q = q.eq('categoriaCampeonatoId', categoria.id)
      equipes = equipes.eq('categoriaCampeonatoId', categoria.id)
    }

    const [{ data, error: err }, equipesResposta] = await Promise.all([q, equipes])
    if (err) throw err
    const linhas: any[] = [...((data ?? []) as any[])]
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
