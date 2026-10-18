import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { anularAcao, corrigirAcao, scoutAtivo, type ClienteDb } from '@/lib/scout'

/** Anula uma ação do scout (soft delete em `anuladoEm`). Idempotente. Mesmo acesso de escrita da súmula. */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteDb

/**
 * Corrige uma ação não anulada: `{ fundamento?, resultado?, zonaOrigem?, zonaDestino?, jogadorId? }` (pelo menos um).
 * Mesmo acesso de escrita e mesma validação do lançamento. Idempotente; ação anulada = 409 ACAO_ANULADA.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
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
    const r = await corrigirAcao(cliente, { id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null }, id, corpo)
    if (r.tipo === 'OK') return success({ acao: r.acao }, 200)
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'CONFLITO') return Response.json({ error: r.mensagem, codigo: r.codigo }, { status: 409 })
    if (r.tipo === 'INVALIDO') return error(r.mensagem, r.status, r.detalhes)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível corrigir a ação.', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
  const { token, id } = await params

  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  const bloqueio = await rejectIfCampeonatoFinalizado(Number(access.partida.ligaId))
  if (bloqueio) return bloqueio

  try {
    const p = access.partida
    const r = await anularAcao(cliente, { id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null }, id)
    if (r.tipo === 'OK') return success({ acao: r.acao }, 200)
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'INVALIDO') return error(r.mensagem, r.status)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível anular a ação.', 500)
  }
}
