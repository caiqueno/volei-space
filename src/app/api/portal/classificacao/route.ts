import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { carregarClassificacaoPorCategoria } from '@/lib/classificacao-por-categoria'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import type { LinhaClassificacao } from '@/lib/operacao-categoria'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Informe o campeonato.', 422)
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)

  const resultado = await carregarClassificacaoPorCategoria(ligaId, categoria.id)
  if ('erro' in resultado) return error(resultado.erro, resultado.status)

  const categorias = resultado.tabelas.map((tabela) => ({
    id: tabela.id,
    nome: tabela.nome,
    linhas: tabela.linhas.map(linhaPublica),
    grupos: tabela.groups.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      vagas: grupo.automaticLimit,
      linhas: grupo.dados.map(linhaPublica),
    })),
  }))

  const resposta = success({ categorias })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}

function linhaPublica(linha: LinhaClassificacao) {
  return {
    posicao: linha.posicao,
    equipeId: linha.equipe.id,
    equipe: linha.equipe.nome,
    pontos: linha.pontos,
    jogos: linha.jogos,
    vitorias: linha.vitorias,
    derrotas: linha.derrotas,
    setsPro: linha.setsPro,
    setsContra: linha.setsContra,
    saldoSets: linha.setsPro - linha.setsContra,
    pontosPro: linha.pontosPro,
    pontosContra: linha.pontosContra,
    saldoPontos: linha.pontosPro - linha.pontosContra,
    punicoes: linha.punicoes,
  }
}
