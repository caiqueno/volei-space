import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { adicionarAtleta, exigirEquipe } from '@/lib/meu-time/dados'
import { novoAtletaSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/equipes/:id/atletas: cadastra um atleta no banco do time.
export const POST = rotaMeuTime<{ id: string }>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const entrada = validar(novoAtletaSchema, await lerCorpo(req))
  return sucesso(await adicionarAtleta(usuarioId, equipe.clubeId, entrada), 201)
})
