import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { lerRegrasDaCategoria } from '@/lib/meu-time/categoria'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/categorias/:categoriaId/regras: regras de elenco para o assistente de inscrição.
// Só exige sessão de equipe (não há vínculo com a categoria antes de inscrever). Sem token nem dados de equipes.
export const GET = rotaMeuTime<{ categoriaId: string }>(async ({ params }) => {
  return sucesso(await lerRegrasDaCategoria(params.categoriaId))
})
