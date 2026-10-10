import { NextRequest, NextResponse } from 'next/server'
import { error, success } from '@/lib/api-response'
import { lerClassificacaoJogadores } from '@/lib/classificacao-jogadores-leitura'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'

export const dynamic = 'force-dynamic'

function semCache(resposta: NextResponse) {
  resposta.headers.set('Cache-Control', 'private, no-store')
  return resposta
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return semCache(error('Informe o campeonato.', 422))
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return semCache(error(categoria.erro, 422))

  try {
    const resultado = await lerClassificacaoJogadores(ligaId, categoria.id)
    if ('erro' in resultado) return semCache(error(resultado.erro, resultado.status))
    return semCache(success(resultado))
  } catch (err) {
    console.error('[rankings-jogadores] erro ao buscar', err)
    return semCache(error('Não foi possível carregar a classificação de jogadores.', 500))
  }
}
