import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { criarEquipe, resumirEquipes } from '@/lib/meu-time/dados'
import { novaEquipeSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/equipes: cria a equipe permanente; quem cria vira RESPONSAVEL.
export const POST = rotaMeuTime(async ({ req, usuarioId }) => {
  const entrada = validar(novaEquipeSchema, await lerCorpo(req))
  const equipe = await criarEquipe(usuarioId, entrada)
  const [resumo] = await resumirEquipes([equipe])
  return sucesso(resumo, 201)
})
