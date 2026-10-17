import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { criarDesafio, desafioAtivo, listarDesafios, type ClienteDesafio, type PartidaDesafio } from '@/lib/desafio'

/**
 * Desafio de vídeo (R11). Desligado por padrão: 404 sem `DESAFIO_ATIVO=1`.
 * GET: acesso de leitura da súmula. POST: apontador/árbitro/organizador (mesmo acesso de escrita da súmula).
 * Ver docs/analise/27-desafio-video.md.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteDesafio
const STATUS_ENCERRADA = ['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'CANCELADA']
const partidaDoDesafio = (p: any): PartidaDesafio => ({ id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null })

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!desafioAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura

  try {
    const r = await listarDesafios(cliente, partidaDoDesafio(access.partida))
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'ERRO') return error(r.mensagem, 500)
    return success(r.desafios)
  } catch {
    return error('Não foi possível listar os desafios.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!desafioAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  const bloqueio = await rejectIfCampeonatoFinalizado(Number(access.partida.ligaId))
  if (bloqueio) return bloqueio
  if (STATUS_ENCERRADA.includes(String(access.partida.status ?? '').toUpperCase())) {
    return error('A partida já terminou: não há mais desafios.', 409)
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return error('Corpo da requisição inválido.', 400)
  }

  try {
    const r = await criarDesafio(cliente, partidaDoDesafio(access.partida), corpo)
    if (r.tipo === 'OK') return success({ desafio: r.desafio }, r.status)
    if (r.tipo === 'INVALIDO') return Response.json({ error: r.mensagem, ...(r.codigo ? { codigo: r.codigo } : {}), details: r.detalhes }, { status: r.status })
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'NAO_ENCONTRADO') return error(r.mensagem, 404)
    if (r.tipo === 'CONFLITO') return error(r.mensagem, 409)
    return error(r.mensagem, 500)
  } catch {
    return error('Não foi possível registrar o desafio.', 500)
  }
}
