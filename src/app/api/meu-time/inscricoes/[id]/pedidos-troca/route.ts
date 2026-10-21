import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { criarPedido, listarPedidosDaInscricao, novoPedidoSchema } from '@/lib/pedido-troca/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/inscricoes/:id/pedidos-troca: pedidos da inscrição e se a troca ainda é livre (prazoTrocaEm).
export const GET = rotaElencoLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'pedido-troca-ler', usuarioId)
  return sucesso(await listarPedidosDaInscricao(usuarioId, params.id))
})

// POST {sai, entra, motivo?, numero?} -> 201 PENDENTE. Só depois do prazo de troca livre (antes: 409 PRAZO_ABERTO).
// entra precisa estar no banco do time e ser elegível; pedido igual pendente = 409 PEDIDO_DUPLICADO. Líder ou técnico.
export const POST = rotaElencoLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'pedido-troca-criar', usuarioId, 20)
  const entrada = validar(novoPedidoSchema, await lerCorpo(req))
  return sucesso(await criarPedido(usuarioId, params.id, entrada), 201)
})
