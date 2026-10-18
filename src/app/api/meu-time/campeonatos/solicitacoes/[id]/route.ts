import { sucesso } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaLider } from '@/lib/inscricoes-solicitacao/acesso'
import { cancelarSolicitacao } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// DELETE /api/meu-time/campeonatos/solicitacoes/:id: cancela uma solicitação PENDENTE da própria equipe (idempotente).
export const DELETE = rotaLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'cancelar', usuarioId)
  return sucesso(await cancelarSolicitacao(usuarioId, params.id))
})
