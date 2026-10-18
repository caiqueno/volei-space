import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { respostaDeExcecao } from '@/lib/banco/acesso'
import { resolverAcessoSessao } from '@/lib/banco/sessao'
import { cancelarPedido, idDeRecurso } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Cancela um pedido PENDENTE da própria equipe pela sessão (RESPONSAVEL, TECNICO ou ASSISTENTE). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ partidaId: string; equipeId: string; id: string }> }) {
  const { partidaId, equipeId, id } = await params
  const acesso = await resolverAcessoSessao(req, partidaId, equipeId, 'pedido')
  if (acesso instanceof Response) return acesso
  const pedidoId = idDeRecurso(id)
  if (!pedidoId) return respostaErro('Pedido não encontrado.', 404)
  try {
    return await cancelarPedido(acesso.partida, acesso.equipeId, pedidoId)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
