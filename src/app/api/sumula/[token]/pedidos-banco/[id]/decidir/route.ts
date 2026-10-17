import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { resolverApontador, respostaDeExcecao } from '@/lib/banco/acesso'
import { decidirPedido, idDeRecurso, lerCorpo } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** O apontador aceita ou recusa um pedido do banco. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const acesso = await resolverApontador(req, token)
  if (acesso instanceof Response) return acesso
  const pedidoId = idDeRecurso(id)
  if (!pedidoId) return respostaErro('Pedido não encontrado.', 404)
  try {
    return await decidirPedido(acesso.partida, acesso.usuarioId, pedidoId, await lerCorpo(req))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
