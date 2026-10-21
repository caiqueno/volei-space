import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoOrganizador } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { decidirPedido, decisaoPedidoSchema } from '@/lib/pedido-troca/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/pedidos-troca/:id/decidir {decisao:'APROVADO'|'RECUSADO', motivo?}.
// Idempotente (repetir a mesma decisão devolve o mesmo resultado); decisão contrária = 409.
// APROVADO aplica a troca na cópia da inscrição com as validações de elenco e avisa o líder (PEDIDO_TROCA_APROVADO/RECUSADO).
export const POST = rotaElencoOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-decidir-troca', organizadorId, 20)
  const entrada = validar(decisaoPedidoSchema, await lerCorpo(req))
  return sucesso(await decidirPedido(organizadorId, params.id, entrada))
})
