import { ErroMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { rotaElencoOrganizador } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { filtroEstadoSchema, listarPedidosDoOrganizador } from '@/lib/pedido-troca/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/pedidos-troca?estado=PENDENTE|APROVADO|RECUSADO|CANCELADO: pedidos das inscrições dos campeonatos
// do organizador (sem estado = todos, até 200). Nunca mostra pedido de outro organizador.
export const GET = rotaElencoOrganizador(async ({ req, organizadorId }) => {
  await limitarUsuario(req, 'org-pedidos-troca', organizadorId)
  const bruto = new URL(req.url).searchParams.get('estado')
  let estado
  if (bruto) {
    const lido = filtroEstadoSchema.safeParse(bruto.toUpperCase())
    if (!lido.success) throw new ErroMeuTime('Filtro "estado" inválido.', 422, 'DADOS_INVALIDOS')
    estado = lido.data
  }
  return sucesso(await listarPedidosDoOrganizador(organizadorId, estado))
})
