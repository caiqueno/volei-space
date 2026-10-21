import { sucesso } from '@/lib/meu-time/acesso'
import { lerCorpo, rotaNotificacoes, validar } from '@/lib/notificacoes-canais/acesso'
import { listarPreferencias, preferenciaSchema, salvarPreferencia } from '@/lib/notificacoes-canais/preferencias'

export const dynamic = 'force-dynamic'

// GET: matriz canal x tipo do próprio usuário, com o padrão aplicado (interna sempre; e-mail nos tipos críticos).
export const GET = rotaNotificacoes('pref-ler', async ({ usuarioId }) => sucesso(await listarPreferencias(usuarioId)))

// PUT {canal, tipo, ativo}: liga ou desliga um canal para um tipo. Idempotente.
export const PUT = rotaNotificacoes('pref-gravar', async ({ req, usuarioId }) => {
  const entrada = validar(preferenciaSchema, await lerCorpo(req))
  return sucesso(await salvarPreferencia(usuarioId, entrada))
})
