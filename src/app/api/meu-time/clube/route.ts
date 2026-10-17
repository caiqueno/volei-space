import { z } from 'zod'
import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { criarClube, verClube } from '@/lib/meu-time-fase2/clube'

export const dynamic = 'force-dynamic'

const clubeSchema = z.object({
  nome: z.string().trim().min(2).max(200),
  cidade: z.string().trim().max(120).optional().nullable(),
})

// GET: o clube do usuário e as equipes dele nesse clube (404 se não tem).
export const GET = rotaFase2(async ({ usuarioId }) => sucesso(await verClube(usuarioId)))

// POST {nome, cidade?}: cria o clube. Quem já tem recebe o existente (200) em vez de um segundo.
export const POST = rotaFase2(async ({ req, usuarioId }) => {
  const entrada = validar(clubeSchema, await lerCorpo(req))
  const { criado, clube } = await criarClube(usuarioId, entrada)
  return sucesso(clube, criado ? 201 : 200)
})
