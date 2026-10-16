import { ErroMeuTime, lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { adicionarMembro, exigirEquipe, listarMembros, removerMembro } from '@/lib/meu-time/dados'
import { novoMembroSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET: contas com acesso à equipe (id, nome, papel). Nunca devolve e-mail ou telefone.
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  return sucesso(await listarMembros(equipe.id))
})

// POST {email, papel}: só o responsável adiciona; a pessoa precisa ter conta.
export const POST = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'responsavel')
  const entrada = validar(novoMembroSchema, await lerCorpo(req))
  return sucesso(await adicionarMembro(equipe.id, entrada), 201)
})

// DELETE ?membroId=: só o responsável remove; o próprio responsável não sai por aqui.
export const DELETE = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'responsavel')
  const membroId = new URL(req.url).searchParams.get('membroId')
  if (!membroId) throw new ErroMeuTime('Informe o membro a remover (membroId).', 400, 'MEMBRO_NAO_INFORMADO')
  await removerMembro(equipe.id, membroId)
  return sucesso({ removido: true })
})
