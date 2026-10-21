import { sucesso } from '@/lib/meu-time/acesso'
import { rotaPagamentoOrganizador } from '@/lib/pagamento-comprovante/acesso'
import { urlDoComprovante } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes/:inscricaoId/pagamento/comprovante-url -> {data:{url, expiraEm}} (URL assinada de 60 s, no-store).
// Dono, ADMINISTRADOR e FINANCEIRO (ARBITRAGEM recebe 403). Inscrição de outro organizador ou sem comprovante = 404.
export const GET = rotaPagamentoOrganizador<{ inscricaoId: string }>('comprovante-url', async ({ usuarioId, params }) => {
  return sucesso(await urlDoComprovante(usuarioId, params.inscricaoId))
})
