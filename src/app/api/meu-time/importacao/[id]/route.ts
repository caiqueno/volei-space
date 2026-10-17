import { sucesso } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { descartarImportacao } from '@/lib/meu-time-fase2/importacao'

export const dynamic = 'force-dynamic'

// DELETE: descarta a prévia (409 se já confirmada).
export const DELETE = rotaFase2<{ id: string }>(async ({ usuarioId, params }) => {
  return sucesso(await descartarImportacao(usuarioId, params.id))
})
