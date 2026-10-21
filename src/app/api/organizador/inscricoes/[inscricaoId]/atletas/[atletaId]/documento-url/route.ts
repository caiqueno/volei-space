import { sucesso } from '@/lib/meu-time/acesso'
import { rotaElencoOrganizador } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { urlDocumentoParaOrganizador } from '@/lib/meu-time/uploads-servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes/:inscricaoId/atletas/:atletaId/documento-url -> {data:{url, expiraEm}} (60 s).
// Só o dono do campeonato da inscrição e só de atleta ativo nela; qualquer outro caso = 404.
export const GET = rotaElencoOrganizador<{ inscricaoId: string; atletaId: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-documento-url', organizadorId, 20)
  const resposta = sucesso(await urlDocumentoParaOrganizador(organizadorId, params.inscricaoId, params.atletaId))
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
})
