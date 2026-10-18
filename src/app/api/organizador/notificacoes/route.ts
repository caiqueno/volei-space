import { sucesso } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaOrganizador } from '@/lib/inscricoes-solicitacao/acesso'
import { notificacoesDoOrganizador } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// GET ?naoLidas=1: notificações do próprio organizador (mais novas primeiro, até 100) e a contagem de não lidas.
export const GET = rotaOrganizador(async ({ req, organizadorId }) => {
  await limitarUsuario(req, 'org-notif', organizadorId)
  const apenasNaoLidas = new URL(req.url).searchParams.get('naoLidas') === '1'
  const { itens, naoLidas } = await notificacoesDoOrganizador(organizadorId, apenasNaoLidas)
  return sucesso(itens, 200, { naoLidas })
})
