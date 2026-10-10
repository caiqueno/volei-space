import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { carregarClassificacaoPorCategoria } from '@/lib/classificacao-por-categoria'
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

    const resultado = await carregarClassificacaoPorCategoria(ligaId, categoria.id)
    if ('erro' in resultado) return error(resultado.erro, resultado.status)
    const resposta = success({ categorias: resultado.tabelas })
    resposta.headers.set('Cache-Control', 'no-store')
    return resposta
  } catch {
    return error('Erro ao buscar classificação', 500)
  }
}
