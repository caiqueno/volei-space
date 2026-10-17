import { sucesso } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { revogarConvite } from '@/lib/meu-time-fase2/convites'

export const dynamic = 'force-dynamic'

// DELETE: revoga o convite (idempotente).
export const DELETE = rotaFase2<{ id: string }>(async ({ usuarioId, params }) => {
  return sucesso(await revogarConvite(usuarioId, params.id))
})
