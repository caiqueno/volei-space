import { sucesso } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { listarNotificacoes } from '@/lib/meu-time-fase2/notificacoes'

export const dynamic = 'force-dynamic'

// GET ?naoLidas=1: notificações do usuário (mais novas primeiro, até 100), com a contagem de não lidas.
export const GET = rotaFase2(async ({ req, usuarioId }) => {
  const apenasNaoLidas = new URL(req.url).searchParams.get('naoLidas') === '1'
  const { itens, naoLidas } = await listarNotificacoes(usuarioId, apenasNaoLidas)
  return sucesso(itens, 200, { naoLidas })
})
