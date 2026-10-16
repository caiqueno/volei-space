import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe, removerComissao } from '@/lib/meu-time/dados'

export const dynamic = 'force-dynamic'

// DELETE: tira a pessoa da comissão técnica do time. Inscrições já enviadas mantêm a própria cópia.
export const DELETE = rotaMeuTime<{ id: string; membroId: string }>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  await removerComissao(equipe.id, params.membroId)
  return sucesso({ removido: true })
})
