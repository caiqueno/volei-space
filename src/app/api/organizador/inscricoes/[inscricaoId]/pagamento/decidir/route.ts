import { lerCorpo, sucesso } from '@/lib/meu-time/acesso'
import { rotaPagamentoOrganizador } from '@/lib/pagamento-comprovante/acesso'
import { decidirPagamento } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/inscricoes/:inscricaoId/pagamento/decidir {decisao:'CONFIRMAR'|'RECUSAR'|'ISENTAR', motivo?}
// -> {data:{valorCentavos, estado, comprovanteEnviadoEm, decididoEm, motivoRecusa}}.
// RECUSAR exige motivo. Idempotente (repetir a decisão devolve o mesmo resultado, sem novo aviso); decisão contrária = 409.
// CONFIRMAR e RECUSAR só sobre comprovante enviado; ISENTAR vale em qualquer estado aberto. Notifica o líder
// (PAGAMENTO_CONFIRMADO / PAGAMENTO_RECUSADO). Dono, ADMINISTRADOR e FINANCEIRO; ARBITRAGEM = 403; outro organizador = 404.
export const POST = rotaPagamentoOrganizador<{ inscricaoId: string }>('decidir', async ({ req, usuarioId, params }) => {
  return sucesso(await decidirPagamento(usuarioId, params.inscricaoId, await lerCorpo(req)))
})
