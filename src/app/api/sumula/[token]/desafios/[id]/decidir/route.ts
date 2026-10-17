import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { decidirDesafio, desafioAtivo, type ClienteDesafio } from '@/lib/desafio'

/**
 * Decide um desafio de vídeo: `{ decisao: 'MANTIDA' | 'REVERTIDA' | 'CANCELADO' }`.
 * Idempotente para a mesma decisão; decisão contrária a uma já tomada = 409. Desligado sem `DESAFIO_ATIVO=1`.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteDesafio

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  if (!desafioAtivo()) return error('Recurso não encontrado.', 404)
  const { token, id } = await params

  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  const bloqueio = await rejectIfCampeonatoFinalizado(Number(access.partida.ligaId))
  if (bloqueio) return bloqueio

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return error('Corpo da requisição inválido.', 400)
  }

  try {
    const p = access.partida
    const r = await decidirDesafio(
      cliente,
      { id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null },
      id,
      corpo,
      access.auth?.userId ? String(access.auth.userId) : null,
    )
    if (r.tipo === 'OK') return success({ desafio: r.desafio }, 200)
    if (r.tipo === 'INVALIDO') return Response.json({ error: r.mensagem, details: r.detalhes }, { status: r.status })
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    if (r.tipo === 'CONFLITO') return Response.json({ error: r.mensagem, codigo: r.codigo }, { status: 409 })
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível decidir o desafio.', 500)
  }
}
