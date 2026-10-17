import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { listarAcoes, registrarAcao, scoutAtivo, type ClienteDb, type PartidaScout } from '@/lib/scout'

/**
 * Scout manual (R11). Desligado por padrão: 404 sem `SCOUT_ATIVO=1`.
 * GET: mesmo acesso de leitura da súmula. POST: mesmo acesso de escrita da súmula (apontador/árbitro/organizador).
 * Ver docs/analise/26-scout.md.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteDb
const partidaDoScout = (p: any): PartidaScout => ({ id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null })

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura

  try {
    const r = await listarAcoes(cliente, partidaDoScout(access.partida), new URL(req.url).searchParams.get('set'))
    if (r.tipo === 'INVALIDO') return error(r.mensagem, 400)
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'ERRO') return error(r.mensagem, 500)
    return success(r.acoes)
  } catch {
    return error('Não foi possível listar as ações.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

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
    const r = await registrarAcao(cliente, partidaDoScout(access.partida), corpo, access.auth?.userId ? String(access.auth.userId) : null)
    if (r.tipo === 'OK') return success({ acao: r.acao }, r.status)
    if (r.tipo === 'INVALIDO') return error(r.mensagem, r.status, r.detalhes)
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível registrar a ação.', 500)
  }
}
