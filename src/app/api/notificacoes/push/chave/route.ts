import { ErroMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { rotaNotificacoes } from '@/lib/notificacoes-canais/acesso'
import { MENSAGEM_CANAIS_NAO_HABILITADO } from '@/lib/notificacoes-canais/flags'
import { chavePublicaVapid } from '@/lib/notificacoes-canais/push'

export const dynamic = 'force-dynamic'

// GET: chave pública VAPID (applicationServerKey do navegador). Só a pública; a privada nunca sai do servidor.
export const GET = rotaNotificacoes('push-chave', async () => {
  const chave = chavePublicaVapid()
  if (!chave) throw new ErroMeuTime(MENSAGEM_CANAIS_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
  return sucesso({ chave })
})
