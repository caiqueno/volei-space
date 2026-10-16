import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { adicionarLote, exigirEquipe } from '@/lib/meu-time/dados'
import { loteAtletasSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/equipes/:id/atletas/lote: "colar lista". Linhas ruins ou repetidas voltam em `ignorados`.
export const POST = rotaMeuTime<{ id: string }>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const entrada = validar(loteAtletasSchema, await lerCorpo(req))
  return sucesso(await adicionarLote(usuarioId, equipe.clubeId, entrada))
})
