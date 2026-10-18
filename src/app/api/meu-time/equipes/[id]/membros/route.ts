import { ErroMeuTime, lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { consumirLimiteAsync, ipDaRequisicao } from '@/lib/rate-limit'
import { MENSAGEM_MEMBRO_UNIFORME, adicionarMembro, exigirEquipe, listarMembros, removerMembro } from '@/lib/meu-time/dados'
import { novoMembroSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET: contas com acesso à equipe (id, nome, papel). Nunca devolve e-mail ou telefone.
export const GET = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'leitura')
  return sucesso(await listarMembros(equipe.id))
})

// Limites contra varredura de e-mails (M10). Store persistente (Supabase) com fallback em memória; ver docs/analise/21.
const LIMITE_MEMBROS_POR_USUARIO = { max: 10, janelaMs: 60 * 60 * 1000 }
const LIMITE_MEMBROS_POR_IP = { max: 30, janelaMs: 60 * 60 * 1000 }

// POST {email, papel}: só o responsável adiciona. A resposta é a mesma (202) exista conta ou não,
// ou a pessoa já seja membro: não revela cadastro, id nem nome. A lista (GET) mostra quem entrou.
export const POST = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'responsavel')
  const porUsuario = await consumirLimiteAsync(`meu-time-membro:u:${usuarioId}`, LIMITE_MEMBROS_POR_USUARIO.max, LIMITE_MEMBROS_POR_USUARIO.janelaMs, 'FECHADO')
  const porIp = await consumirLimiteAsync(`meu-time-membro:ip:${ipDaRequisicao(req)}`, LIMITE_MEMBROS_POR_IP.max, LIMITE_MEMBROS_POR_IP.janelaMs, 'FECHADO')
  if (!porUsuario.ok || !porIp.ok) {
    const espera = Math.max(porUsuario.retryAfterSeconds, porIp.retryAfterSeconds)
    throw new ErroMeuTime('Muitas tentativas de adicionar pessoas. Aguarde e tente de novo.', 429, 'LIMITE_DE_TAXA', { retryAfterSeconds: espera })
  }
  const entrada = validar(novoMembroSchema, await lerCorpo(req))
  await adicionarMembro(equipe.id, entrada)
  return sucesso({ solicitado: true, mensagem: MENSAGEM_MEMBRO_UNIFORME }, 202)
})

// DELETE ?membroId=: só o responsável remove; o próprio responsável não sai por aqui.
export const DELETE = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'responsavel')
  const membroId = new URL(req.url).searchParams.get('membroId')
  if (!membroId) throw new ErroMeuTime('Informe o membro a remover (membroId).', 400, 'MEMBRO_NAO_INFORMADO')
  await removerMembro(equipe.id, membroId)
  return sucesso({ removido: true })
})
