import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { listarEquipesDoUsuario, resumirEquipes } from '@/lib/meu-time/dados'

export const dynamic = 'force-dynamic'

// GET /api/meu-time: as equipes do usuário logado, com o cartão de prontidão de cada uma.
export const GET = rotaMeuTime(async ({ usuarioId }) => {
  const equipes = await listarEquipesDoUsuario(usuarioId)
  return sucesso({ equipes: await resumirEquipes(equipes) })
})
