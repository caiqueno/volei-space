import { z } from 'zod'
import { ErroMeuTime, lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { criarPrevia } from '@/lib/meu-time-fase2/importacao'
import { consumirLimiteAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const importacaoSchema = z.object({
  equipeId: z.string().uuid(),
  csv: z.string().min(1).max(100_000),
})

// POST {equipeId, csv}: só a prévia (não grava atletas). Até 60 linhas.
export const POST = rotaFase2(async ({ req, usuarioId }) => {
  const limite = await consumirLimiteAsync(`meu-time-importacao:u:${usuarioId}`, 20, 60 * 60 * 1000, 'FECHADO')
  if (!limite.ok) {
    throw new ErroMeuTime('Muitas importações. Aguarde e tente de novo.', 429, 'LIMITE_DE_TAXA', { retryAfterSeconds: limite.retryAfterSeconds })
  }
  const entrada = validar(importacaoSchema, await lerCorpo(req))
  return sucesso(await criarPrevia(usuarioId, entrada.equipeId, entrada.csv), 201)
})
