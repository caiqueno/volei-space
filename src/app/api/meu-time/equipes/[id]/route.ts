import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe, editarEquipe, listarAtletasPublicos, listarComissaoTolerante, listarMembros } from '@/lib/meu-time/dados'
import { listarInscricoesDaEquipe } from '@/lib/meu-time/inscricao'
import { resumoProntidao } from '@/lib/meu-time/regras'
import { editarEquipeSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/meu-time/equipes/:id: detalhe da equipe (só para quem é membro dela). `comissao` = comissão técnica; `membros` = contas com acesso.
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe, papel } = await exigirEquipe(usuarioId, params.id, 'leitura')
  const [atletas, comissao, membros, inscricoes] = await Promise.all([
    listarAtletasPublicos(equipe.clubeId),
    listarComissaoTolerante(equipe.id),
    listarMembros(equipe.id),
    listarInscricoesDaEquipe(equipe.id),
  ])
  return sucesso({
    equipe: { id: equipe.id, nome: equipe.nome, cidade: equipe.cidade, naipe: equipe.naipe, escudoUrl: equipe.escudoUrl },
    // Papel de quem está logado nesta equipe: a tela usa para mostrar ou esconder botões de gestão.
    meuPapel: papel,
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
