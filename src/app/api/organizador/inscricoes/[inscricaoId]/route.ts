import { sucesso } from '@/lib/meu-time/acesso'
import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { detalharInscricao } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes/:id: detalhe com atletas (nome abreviado, camisa, capitão, líbero, temFoto/temDocumento/temCpf),
// comissão e comentários. Inscrição de outro organizador = 404. Nunca devolve CPF, telefone, documento nem nascimento.
export const GET = rotaPainel<{ inscricaoId: string }>('detalhe', async ({ usuarioId, params }) =>
  sucesso(await detalharInscricao(usuarioId, params.inscricaoId)),
)
