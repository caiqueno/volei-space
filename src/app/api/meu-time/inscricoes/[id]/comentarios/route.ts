import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { rotaLiderPainel } from '@/lib/painel-inscricoes/acesso'
import { comentarioSchema, listarComentariosDoLider, responderComentario } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/inscricoes/:id/comentarios: conversa com o organizador. Qualquer membro da equipe lê; outra equipe = 404.
export const GET = rotaLiderPainel<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'comentarios-ler', usuarioId)
  return sucesso(await listarComentariosDoLider(usuarioId, params.id))
})

// POST {mensagem}: o líder (ou técnico) responde ao pedido de ajuste. Cria RESPOSTA, a inscrição volta a EM_ANALISE e o
// organizador é notificado. Assistente = 403. Inscrição recusada/rascunho ou campeonato finalizado = 409.
export const POST = rotaLiderPainel<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'comentarios-gravar', usuarioId, 20)
  const entrada = validar(comentarioSchema, await lerCorpo(req))
  return sucesso(await responderComentario(usuarioId, params.id, entrada), 201)
})
