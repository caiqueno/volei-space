import { sucesso } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { urlDocumentoParaLider } from '@/lib/meu-time/uploads-servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/atletas/:id/documento-url -> {data:{url, expiraEm}}. URL assinada de LEITURA, válida por 60 s.
// Só líder/técnico de uma equipe cujo banco tem o atleta; para os demais, 404.
export const GET = rotaElencoLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'documento-url', usuarioId, 20)
  const resposta = sucesso(await urlDocumentoParaLider(usuarioId, params.id))
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
})
