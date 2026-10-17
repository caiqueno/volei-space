import { sucesso } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { marcarLida } from '@/lib/meu-time-fase2/notificacoes'

export const dynamic = 'force-dynamic'

// POST: marca a notificação do próprio usuário como lida (idempotente).
export const POST = rotaFase2<{ id: string }>(async ({ usuarioId, params }) => sucesso(await marcarLida(usuarioId, params.id)))
