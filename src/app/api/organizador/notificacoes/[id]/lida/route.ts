import { sucesso } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaOrganizador } from '@/lib/inscricoes-solicitacao/acesso'
import { marcarNotificacaoDoOrganizador } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/notificacoes/:id/lida: idempotente; notificação de outro usuário = 404.
export const POST = rotaOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-notif', organizadorId)
  return sucesso(await marcarNotificacaoDoOrganizador(organizadorId, params.id))
})
