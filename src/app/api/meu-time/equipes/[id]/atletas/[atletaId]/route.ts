import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { editarAtleta, exigirEquipe, removerAtleta } from '@/lib/meu-time/dados'
import { editarAtletaSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string; atletaId: string }

// PATCH: edita nome, nascimento, número preferido ou posição de um atleta do banco do time.
export const PATCH = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const entrada = validar(editarAtletaSchema, await lerCorpo(req))
  return sucesso(await editarAtleta(equipe.clubeId, params.atletaId, entrada))
})

// DELETE: tira o atleta do banco do time. Inscrições já enviadas mantêm a própria cópia.
export const DELETE = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  await removerAtleta(equipe.clubeId, params.atletaId)
  return sucesso({ removido: true })
})
