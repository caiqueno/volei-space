import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe, listarAtletasPublicos } from '@/lib/meu-time/dados'
import { elencoCompletoAtivo } from '@/lib/meu-time/elenco'
import { resumoProntidao } from '@/lib/meu-time/regras'
import { documentosExigidosDaEquipe } from '@/lib/regras-elenco/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/equipes/:id/prontidao: "Seu time tem 9 atletas. 2 estão sem documento."
// Com ELENCO_COMPLETO_ATIVO=1 conta também foto e CPF faltando, conforme a regra de elenco das inscrições da equipe.
export const GET = rotaMeuTime<{ id: string }>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const atletas = await listarAtletasPublicos(equipe.clubeId)
  const exigidos = elencoCompletoAtivo() ? await documentosExigidosDaEquipe(equipe.id) : undefined
  return sucesso(resumoProntidao(atletas, { exigidos }))
})
