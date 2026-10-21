import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { inscreverEquipe } from '@/lib/meu-time/inscricao'
import { novaInscricaoSchema } from '@/lib/meu-time/schemas'
import { garantirPagamentoSemFalhar } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/equipes/:id/inscricoes: inscrição automática (CONFIRMADA ou CONFIRMADA_COM_PENDENCIAS).
// Não existe fila de aprovação. `avisos` traz pendências (ex.: atleta sem documento) e lembretes.
// R19 (PAGAMENTO_COMPROVANTE_ATIVO): em categoria que cobra por comprovante a inscrição nasce com o pagamento PENDENTE
// (cópia do valor da categoria neste momento) e a resposta ganha `pagamento: {exige, estado, valorCentavos}`.
export const POST = rotaMeuTime<{ id: string }>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const pedido = validar(novaInscricaoSchema, await lerCorpo(req))
  const { resumo, avisos, avisosDetalhe } = await inscreverEquipe(usuarioId, equipe, pedido)
  const pagamento = await garantirPagamentoSemFalhar(resumo.id)
  return sucesso(resumo, 201, {
    avisos,
    avisosDetalhe,
    ...(pagamento ? { pagamento: { exige: true, estado: pagamento.estado, valorCentavos: pagamento.valorCentavos } } : {}),
  })
})
