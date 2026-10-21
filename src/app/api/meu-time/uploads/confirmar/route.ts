import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { confirmarUpload, confirmarUploadSchema } from '@/lib/meu-time/uploads-servico'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/uploads/confirmar {equipeId, atletaId?, tipo, path} -> 200.
// Confere no Storage que o objeto existe, com tamanho e MIME reais dentro do limite; só então grava o path e a data.
export const POST = rotaElencoLider(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'upload-confirmar', usuarioId, 30)
  const entrada = validar(confirmarUploadSchema, await lerCorpo(req))
  const resposta = sucesso(await confirmarUpload(usuarioId, entrada))
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
})
