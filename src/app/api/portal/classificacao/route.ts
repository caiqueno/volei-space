import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Informe o campeonato.', 422)
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)

  let tabela = supabaseAdmin
    .from('ClassificacaoEntrada')
    .select('posicao,pontos,jogos,vitorias,derrotas,setsPro,setsContra,pontosPro,pontosContra,equipeId,equipe:Equipe(id,nome)')
    .eq('ligaId', ligaId)
    .order('posicao', { ascending: true })
  let equipesConsulta = supabaseAdmin
    .from('Equipe')
    .select('id,nome')
    .eq('ligaId', ligaId)
    .eq('statusEquipe', 'ATIVA')
    .order('nome', { ascending: true })
  if (categoria.id) {
    tabela = tabela.eq('categoriaCampeonatoId', categoria.id)
    equipesConsulta = equipesConsulta.eq('categoriaCampeonatoId', categoria.id)
  }

  const [{ data, error: falha }, equipesResposta] = await Promise.all([
    tabela,
    equipesConsulta,
  ])

  if (falha) return error('Não foi possível carregar a classificação.', 500)

  const linhas = (data ?? []).map((linha) => {
    const equipe = Array.isArray(linha.equipe) ? linha.equipe[0] : linha.equipe
    return {
      posicao: Number(linha.posicao),
      equipeId: Number(linha.equipeId ?? equipe?.id ?? 0),
      equipe: equipe?.nome ?? 'Equipe',
      pontos: Number(linha.pontos ?? 0),
      jogos: Number(linha.jogos ?? 0),
      vitorias: Number(linha.vitorias ?? 0),
      derrotas: Number(linha.derrotas ?? 0),
      setsPro: Number(linha.setsPro ?? 0),
      saldoSets: Number(linha.setsPro ?? 0) - Number(linha.setsContra ?? 0),
    }
  })
  const presentes = new Set(linhas.map((linha) => linha.equipeId))
  let proxima = linhas.reduce((maior, linha) => Math.max(maior, linha.posicao), 0)
  for (const equipe of equipesResposta.data ?? []) {
    if (presentes.has(equipe.id)) continue
    proxima += 1
    linhas.push({
      posicao: proxima,
      equipeId: equipe.id,
      equipe: equipe.nome,
      pontos: 0,
      jogos: 0,
      vitorias: 0,
      derrotas: 0,
      setsPro: 0,
      saldoSets: 0,
    })
  }
  linhas.sort((a, b) => a.posicao - b.posicao || b.pontos - a.pontos || a.equipe.localeCompare(b.equipe, 'pt-BR'))

  const resposta = success({ linhas })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
