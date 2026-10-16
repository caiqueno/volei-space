import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe, editarEquipe, listarAtletasDoClube, listarComissaoTolerante, listarMembros, paraAtleta } from '@/lib/meu-time/dados'
import { listarInscricoesDaEquipe } from '@/lib/meu-time/inscricao'
import { resumoProntidao } from '@/lib/meu-time/regras'
import { editarEquipeSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/meu-time/equipes/:id: detalhe da equipe (só para quem é membro dela). `comissao` = comissão técnica; `membros` = contas com acesso.
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const [linhas, comissao, membros, inscricoes] = await Promise.all([
    listarAtletasDoClube(equipe.clubeId),
    listarComissaoTolerante(equipe.id),
    listarMembros(equipe.id),
    listarInscricoesDaEquipe(equipe.id),
  ])
  const atletas = linhas.map(paraAtleta)
  return sucesso({
    equipe: { id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl },
    atletas,
    comissao,
    membros,
    inscricoes,
    prontidao: resumoProntidao(atletas),
  })
})

// PATCH {nome?, cidade?, escudoUrl?}: aba "Dados do time". Só o responsável; naipe não muda.
export const PATCH = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  await exigirEquipe(usuarioId, params.id, 'responsavel')
  const entrada = validar(editarEquipeSchema, await lerCorpo(req))
  const equipe = await editarEquipe(params.id, entrada)
  return sucesso({ id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl })
})
