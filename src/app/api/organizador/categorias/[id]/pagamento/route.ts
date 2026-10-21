import { lerCorpo, sucesso } from '@/lib/meu-time/acesso'
import { rotaPagamentoOrganizador } from '@/lib/pagamento-comprovante/acesso'
import { gravarConfigPagamento, lerConfigPagamento } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// GET/PUT /api/organizador/categorias/:id/pagamento (flag PAGAMENTO_COMPROVANTE_ATIVO; desligada = 404).
// GET (qualquer papel da organização) -> {data:{modo, valorCentavos, pixChave, pixBeneficiario, instrucoes}}.
// PUT {modo:'NENHUM'|'COMPROVANTE', valorCentavos?, pixChave?, pixBeneficiario?, instrucoes?}: só dono ou ADMINISTRADOR.
// COMPROVANTE exige valorCentavos > 0 e pixChave; campeonato finalizado = 409; categoria de outro organizador = 404.
// Mudar o valor depois não altera inscrições já criadas (cada pagamento guarda a própria cópia).
export const GET = rotaPagamentoOrganizador<{ id: string }>('categoria', async ({ usuarioId, params }) => {
  return sucesso(await lerConfigPagamento(usuarioId, params.id))
})

export const PUT = rotaPagamentoOrganizador<{ id: string }>('categoria', async ({ req, usuarioId, params }) => {
  return sucesso(await gravarConfigPagamento(usuarioId, params.id, await lerCorpo(req)))
})
