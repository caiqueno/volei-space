import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { exigirOrganizadorOuAdminDaLiga } from '@/lib/organizador-isolamento'
import { listarElenco } from '@/lib/elenco-servidor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ligaId = Number(req.nextUrl.searchParams.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)
  const acesso = await exigirOrganizadorOuAdminDaLiga(req, ligaId)
  if (acesso instanceof Response) return acesso
  const categoria = req.nextUrl.searchParams.get('categoriaCampeonatoId')
  try {
    const linhas = await listarElenco(ligaId, categoria)
    return success({ linhas })
  } catch (falha) {
    console.error('[organizador/elenco] erro ao listar', falha)
    return error('Não foi possível carregar o elenco.', 500)
  }
}
