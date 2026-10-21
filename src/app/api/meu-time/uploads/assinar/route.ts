import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { assinarUpload, assinarUploadSchema } from '@/lib/meu-time/uploads-servico'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/uploads/assinar {equipeId, atletaId?, tipo:'ESCUDO'|'FOTO_ROSTO'|'DOCUMENTO', nomeArquivo, contentType, tamanho}
// -> 200 {data:{uploadUrl, path, expiraEm}}. Líder/técnico da equipe. O path nasce no servidor (uuid), nunca do nome do arquivo.
export const POST = rotaElencoLider(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'upload-assinar', usuarioId, 30)
  const entrada = validar(assinarUploadSchema, await lerCorpo(req))
  const resposta = sucesso(await assinarUpload(usuarioId, entrada))
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
})
