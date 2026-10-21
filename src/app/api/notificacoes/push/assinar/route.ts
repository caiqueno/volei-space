import { sucesso } from '@/lib/meu-time/acesso'
import { lerCorpo, rotaNotificacoes, validar } from '@/lib/notificacoes-canais/acesso'
import { assinarPush, assinaturaPushSchema, cancelarPush, cancelarPushSchema } from '@/lib/notificacoes-canais/push'

export const dynamic = 'force-dynamic'

// POST {endpoint, chaves:{p256dh, auth}}: registra o aparelho para o "toque" de push (sem conteúdo). Idempotente.
export const POST = rotaNotificacoes('push-assinar', async ({ req, usuarioId }) => {
  const entrada = validar(assinaturaPushSchema, await lerCorpo(req))
  return sucesso(await assinarPush(usuarioId, entrada))
})

// DELETE {endpoint}: remove a assinatura do próprio usuário. Idempotente.
export const DELETE = rotaNotificacoes('push-cancelar', async ({ req, usuarioId }) => {
  const entrada = validar(cancelarPushSchema, await lerCorpo(req))
  return sucesso(await cancelarPush(usuarioId, entrada.endpoint))
})
