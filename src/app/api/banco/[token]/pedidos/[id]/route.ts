import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { resolverAcessoBanco, respostaDeExcecao } from '@/lib/banco/acesso'
import { cancelarPedido, idDeRecurso } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Cancela um pedido PENDENTE da própria equipe. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const acesso = await resolverAcessoBanco(req, token)
  if (acesso instanceof Response) return acesso
  const pedidoId = idDeRecurso(id)
  if (!pedidoId) return respostaErro('Pedido não encontrado.', 404)
  try {
    return await cancelarPedido(acesso.partida, acesso.equipeId, pedidoId)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
