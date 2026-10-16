import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { adicionarComissao, exigirEquipe, listarComissao } from '@/lib/meu-time/dados'
import { novaComissaoSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET: comissão técnica da equipe (id, nome, funcao), da tabela "ComissaoTime".
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  return sucesso(await listarComissao(equipe.id))
})

// POST {nome, funcao}: RESPONSAVEL e TECNICO cadastram a pessoa da comissão (não precisa de conta).
export const POST = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const entrada = validar(novaComissaoSchema, await lerCorpo(req))
  return sucesso(await adicionarComissao(equipe.id, entrada), 201)
})
