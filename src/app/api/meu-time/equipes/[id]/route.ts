import { rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe, listarAtletasDoClube, listarComissao, paraAtleta } from '@/lib/meu-time/dados'
import { listarInscricoesDaEquipe } from '@/lib/meu-time/inscricao'
import { resumoProntidao } from '@/lib/meu-time/regras'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/meu-time/equipes/:id: detalhe da equipe (só para quem é membro dela).
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const [linhas, comissao, inscricoes] = await Promise.all([
    listarAtletasDoClube(equipe.clubeId),
    listarComissao(equipe.id),
    listarInscricoesDaEquipe(equipe.id),
  ])
  const atletas = linhas.map(paraAtleta)
  return sucesso({
    equipe: { id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl },
    atletas,
    comissao,
    inscricoes,
    prontidao: resumoProntidao(atletas),
  })
})
