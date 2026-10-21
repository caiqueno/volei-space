import { sucesso } from '@/lib/meu-time/acesso'
import { rotaPagamentoLider } from '@/lib/pagamento-comprovante/acesso'
import { consultarPagamentoDoLider } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/inscricoes/:id/pagamento (flags PAGAMENTO_COMPROVANTE_ATIVO + MEU_TIME_ATIVO; desligada = 404).
// -> {data:{exige, valorCentavos, pix:{chave, beneficiario, instrucoes}, estado, motivoRecusa?, comprovanteEnviado}}.
// Só líder (RESPONSAVEL) ou técnico da equipe da inscrição vê a chave Pix; outra equipe = 404, assistente = 403.
// O envio do comprovante usa POST /api/meu-time/uploads/assinar e /confirmar com tipo 'COMPROVANTE' e `inscricaoId`.
export const GET = rotaPagamentoLider<{ id: string }>('consulta', async ({ usuarioId, params }) => {
  return sucesso(await consultarPagamentoDoLider(usuarioId, params.id))
})
