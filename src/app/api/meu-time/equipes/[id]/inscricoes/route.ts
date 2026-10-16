import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { inscreverEquipe } from '@/lib/meu-time/inscricao'
import { novaInscricaoSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/equipes/:id/inscricoes: inscrição automática (CONFIRMADA ou CONFIRMADA_COM_PENDENCIAS).
// Não existe fila de aprovação. `avisos` traz pendências (ex.: atleta sem documento) e lembretes.
export const POST = rotaMeuTime<{ id: string }>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const pedido = validar(novaInscricaoSchema, await lerCorpo(req))
  const { resumo, avisos } = await inscreverEquipe(usuarioId, equipe, pedido)
  return sucesso(resumo, 201, { avisos })
})
