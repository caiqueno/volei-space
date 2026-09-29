import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole, verifyToken } from '@/lib/auth'
import { isCampeonatoFinalizado, STATUS_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,organizadorId,status')
    .eq('id', ligaId)
    .single()

  if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
  if (isCampeonatoFinalizado(liga.status)) return error('Este campeonato já está finalizado.', 409)

  let autor: string | null = null
  const organizador = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (!(organizador instanceof Response) && organizador.userId === liga.organizadorId) {
    autor = organizador.userId
  } else {
    const admin = await verifyToken(req)
    if (!admin) {
      if (organizador instanceof Response) return organizador
      return error('Você não pode finalizar este campeonato.', 403)
    }
    autor = String(admin.email ?? 'admin')
  }

  const finalizadoEm = new Date().toISOString()
  const { data, error: updateErr } = await supabase
    .from('Liga')
    .update({
      status: STATUS_CAMPEONATO_FINALIZADO,
      inscricoesAbertas: false,
      finalizadoEm,
      finalizadoPor: autor,
    })
    .eq('id', ligaId)
    .select('id,status,slug,nome,finalizadoEm,finalizadoPor')
    .single()

  if (updateErr || !data) return error('Não foi possível finalizar o campeonato.', 500)

  return success({
    ...data,
    mensagem: 'Campeonato finalizado. Ele permanece disponível para consulta e apresentação.',
  })
}
