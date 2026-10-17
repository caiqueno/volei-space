import { z } from 'zod'
import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { vincularEquipe } from '@/lib/meu-time-fase2/clube'

export const dynamic = 'force-dynamic'

const vinculoSchema = z.object({ equipeId: z.string().uuid() })

// POST {equipeId}: vincula ao clube do usuário uma equipe que ele lidera.
export const POST = rotaFase2(async ({ req, usuarioId }) => {
  const entrada = validar(vinculoSchema, await lerCorpo(req))
  return sucesso(await vincularEquipe(usuarioId, entrada.equipeId))
})
