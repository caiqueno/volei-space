import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { decidirDesafio, desafioAtivo, type ClienteDesafio } from '@/lib/desafio'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import {
  configDaPartida,
  contextoDaPartida,
  registrarDecisaoDesafioNoLog,
  sumulaEventosAtivo,
  type ClienteEventos,
} from '@/lib/sumula-eventos'

/**
 * Decide um desafio de vídeo: `{ decisao: 'MANTIDA' | 'REVERTIDA' | 'CANCELADO' }`.
 * Idempotente para a mesma decisão; decisão contrária a uma já tomada = 409. Desligado sem `DESAFIO_ATIVO=1`.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteDesafio

/**
 * Com SUMULA_EVENTOS_ATIVO=1 e a tabela existente, registra a decisão como evento DESAFIO no log da súmula
 * (só registro: não altera placar nem repete rally; isso é decisão da arbitragem). Repetir a mesma decisão
 * reaproveita o mesmo clientEventId (idempotente). Qualquer falha é só logada: a decisão já foi gravada.
 */
async function registrarNoLog(access: { partida: any; auth?: { tipo?: string; userId?: unknown } | null }, desafio: { id: string; setNumero: number; equipeId: number; estado: string }) {
  if (!sumulaEventosAtivo()) return
  try {
    const p = access.partida
    const regras = await regrasEfetivasDaPartida(p)
    const r = await registrarDecisaoDesafioNoLog(
      supabaseAdmin as unknown as ClienteEventos,
      {
        partida: { id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null },
        config: configDaPartida(regras),
        contexto: contextoDaPartida(p),
      },
      desafio,
      { autorTipo: access.auth?.tipo === 'organizador' ? 'ORGANIZADOR' : 'ARBITRO', autorRef: access.auth?.userId ? String(access.auth.userId) : null },
    )
    if (r.tipo === 'FALHOU') console.warn('[desafio] decisão não registrada no log da súmula:', r.motivo)
  } catch {
    console.warn('[desafio] decisão não registrada no log da súmula.')
  }
}

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
    if (r.tipo === 'OK') {
      await registrarNoLog(access, r.desafio)
      return success({ desafio: r.desafio }, 200)
    }
    if (r.tipo === 'INVALIDO') return Response.json({ error: r.mensagem, details: r.detalhes }, { status: r.status })
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    if (r.tipo === 'CONFLITO') return Response.json({ error: r.mensagem, codigo: r.codigo }, { status: 409 })
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível decidir o desafio.', 500)
  }
}
