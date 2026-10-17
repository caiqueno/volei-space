import { sucesso } from '@/lib/meu-time/acesso'
import { rotaFase2 } from '@/lib/meu-time-fase2/acesso'
import { confirmarImportacao } from '@/lib/meu-time-fase2/importacao'

export const dynamic = 'force-dynamic'

// POST: cria os atletas válidos da prévia. Idempotente: repetir devolve o mesmo resultado.
export const POST = rotaFase2<{ id: string }>(async ({ usuarioId, params }) => {
  const { repetida, ...resultado } = await confirmarImportacao(usuarioId, params.id)
  return sucesso(resultado, 200, { repetida })
})
