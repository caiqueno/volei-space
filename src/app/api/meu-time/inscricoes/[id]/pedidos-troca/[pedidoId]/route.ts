import { sucesso } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { cancelarPedido } from '@/lib/pedido-troca/servico'

export const dynamic = 'force-dynamic'

// DELETE /api/meu-time/inscricoes/:id/pedidos-troca/:pedidoId: cancela pedido PENDENTE (idempotente; já decidido = 409).
export const DELETE = rotaElencoLider<{ id: string; pedidoId: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'pedido-troca-cancelar', usuarioId, 20)
  return sucesso(await cancelarPedido(usuarioId, params.id, params.pedidoId))
})
