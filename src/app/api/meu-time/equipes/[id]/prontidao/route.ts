import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe, listarAtletasDoClube, paraAtleta } from '@/lib/meu-time/dados'
import { resumoProntidao } from '@/lib/meu-time/regras'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/equipes/:id/prontidao: "Seu time tem 9 atletas. 2 estão sem documento."
export const GET = rotaMeuTime<{ id: string }>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const atletas = (await listarAtletasDoClube(equipe.clubeId)).map(paraAtleta)
  return sucesso(resumoProntidao(atletas))
})
