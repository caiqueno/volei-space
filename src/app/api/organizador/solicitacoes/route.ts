import { sucesso } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaOrganizador } from '@/lib/inscricoes-solicitacao/acesso'
import { listarParaOrganizador } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/solicitacoes?estado=&ligaId=: só as solicitações das ligas do próprio organizador, sem PII de atletas.
export const GET = rotaOrganizador(async ({ req, organizadorId }) => {
  await limitarUsuario(req, 'org-lista', organizadorId)
  const busca = new URL(req.url).searchParams
  return sucesso(await listarParaOrganizador(organizadorId, { estado: busca.get('estado'), ligaId: busca.get('ligaId') }))
})
