import { z } from 'zod'
import { ErroMeuTime, idValido, lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { criarConvite, listarConvites } from '@/lib/meu-time-fase2/convites'
import { consumirLimite } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const novoConviteSchema = z.object({
  equipeId: z.string().uuid(),
  contato: z.string().trim().min(5).max(200).optional().nullable(),
})

function origem(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(req.url).origin
}

// POST {equipeId, contato?}: gera o link (token mostrado uma única vez). Líder ou técnico da equipe.
export const POST = rotaFase2(async ({ req, usuarioId }) => {
  const limite = consumirLimite(`meu-time-convite:u:${usuarioId}`, 30, 60 * 60 * 1000)
  if (!limite.ok) {
    throw new ErroMeuTime('Muitos convites gerados. Aguarde e tente de novo.', 429, 'LIMITE_DE_TAXA', { retryAfterSeconds: limite.retryAfterSeconds })
  }
  const entrada = validar(novoConviteSchema, await lerCorpo(req))
  return sucesso(await criarConvite(usuarioId, entrada.equipeId, entrada.contato, origem(req)), 201)
})

// GET ?equipeId=: convites da equipe, sem token.
export const GET = rotaFase2(async ({ req, usuarioId }) => {
  const equipeId = new URL(req.url).searchParams.get('equipeId')
  if (!idValido(equipeId)) throw new ErroMeuTime('Informe a equipe (equipeId).', 400, 'EQUIPE_NAO_INFORMADA')
  return sucesso(await listarConvites(usuarioId, equipeId))
})
