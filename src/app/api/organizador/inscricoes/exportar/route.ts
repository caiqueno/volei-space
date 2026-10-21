import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { VERSAO_ESQUEMA_CSV } from '@/lib/painel-inscricoes/regras'
import { exportarInscricoes } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/inscricoes/exportar?ligaId=&categoriaId=&status=: CSV UTF-8 com BOM, separador ';', cabeçalho fixo
// (equipe;cidade;categoria;status;nº atletas;pendências;atualizado em). Células que começam com = + - @ são neutralizadas.
// Sem CPF, telefone, documento nem nome de atleta. A versão do esquema vai no cabeçalho X-Esquema-Csv.
export const GET = rotaPainel('exportar', async ({ req, usuarioId }) => {
  const busca = new URL(req.url).searchParams
  const csv = await exportarInscricoes(usuarioId, {
    ligaId: busca.get('ligaId'),
    categoriaId: busca.get('categoriaId'),
    status: busca.get('status'),
    q: busca.get('q'),
  })
  const dia = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inscricoes-${VERSAO_ESQUEMA_CSV}-${dia}.csv"`,
      'X-Esquema-Csv': VERSAO_ESQUEMA_CSV,
      'Cache-Control': 'no-store',
    },
  })
})
