import { sucesso } from '@/lib/meu-time/acesso'
import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { listarInscricoesDoPainel } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes?ligaId=&categoriaId=&status=&q=&pagina=
// Flag PAINEL_INSCRICOES_ATIVO. Só campeonatos do próprio organizador (ou da organização em que é membro).
// Sem dado pessoal: equipe, categoria, status, quantidade de atletas e pendências agregadas.
export const GET = rotaPainel('listar', async ({ req, usuarioId }) => {
  const busca = new URL(req.url).searchParams
  return sucesso(
    await listarInscricoesDoPainel(usuarioId, {
      ligaId: busca.get('ligaId'),
      categoriaId: busca.get('categoriaId'),
      status: busca.get('status'),
      q: busca.get('q'),
      pagina: busca.get('pagina'),
    }),
  )
})
