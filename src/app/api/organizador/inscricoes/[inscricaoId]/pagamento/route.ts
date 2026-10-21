import { sucesso } from '@/lib/meu-time/acesso'
import { rotaPagamentoOrganizador } from '@/lib/pagamento-comprovante/acesso'
import { lerPagamentoParaOrganizador } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes/:inscricaoId/pagamento (flag PAGAMENTO_COMPROVANTE_ATIVO; desligada = 404).
// -> {data:{exige, valorCentavos, estado, comprovanteEnviadoEm, decididoEm, motivoRecusa, temComprovante}}.
// Nunca devolve o caminho nem a URL do comprovante (só a rota comprovante-url, assinada por 60 s).
// Qualquer papel da organização lê; inscrição de outro organizador = 404.
export const GET = rotaPagamentoOrganizador<{ inscricaoId: string }>('inscricao', async ({ usuarioId, params }) => {
  return sucesso(await lerPagamentoParaOrganizador(usuarioId, params.inscricaoId))
})
