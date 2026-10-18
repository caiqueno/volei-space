import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaOrganizador } from '@/lib/inscricoes-solicitacao/acesso'
import { decidirSolicitacao, decisaoSchema } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/solicitacoes/:id/decidir {decisao:'APROVADA'|'RECUSADA', motivo?}.
// Idempotente (repetir a mesma decisão devolve o mesmo resultado); decisão contrária = 409.
// APROVADA cria a inscrição pelo caminho existente (inscreverEquipe) e avisa o líder.
export const POST = rotaOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-decidir', organizadorId, 20)
  const entrada = validar(decisaoSchema, await lerCorpo(req))
  return sucesso(await decidirSolicitacao(organizadorId, params.id, entrada))
})
