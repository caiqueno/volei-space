import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { listarCampeonatosPublicos } from '@/lib/campeonatos-publicos'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const lista = await listarCampeonatosPublicos({
    busca: params.get('q') ?? '',
    offset: Number(params.get('offset') ?? 0),
    limite: Number(params.get('limite') ?? 12),
  })
  if (lista.erro) return error('Não foi possível carregar os campeonatos.', 500)
  const resposta = success({ campeonatos: lista.campeonatos, temMais: lista.temMais, proximoOffset: lista.proximoOffset })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
