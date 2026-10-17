import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'
import { campeonatoPublicadoDaLiga } from '@/lib/visibilidade-competicao'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { configDaPartida, sumulaEventosAtivo, type ClienteEventos } from '@/lib/sumula-eventos'
import { aoVivoAtivo, CACHE_CONTROL_AO_VIVO, idDePartidaAoVivo, lerAoVivo } from '@/lib/ao-vivo'

/**
 * Placar ao vivo PÚBLICO (sem login e sem dados pessoais). Desligado por padrão: 404 sem `AO_VIVO_ATIVO=1`.
 * Limite por IP (120/min). Cache de CDN de 2 s só na resposta 200. Competição privada, simulação,
 * rascunho e partida inexistente respondem o mesmo 404. Ver docs/analise/28-ao-vivo-publico.md.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteEventos
const LIMITE_POR_MINUTO = 120

const SEM_CACHE = 'no-store'
function resposta(corpo: unknown, status: number, cache: string, extra: Record<string, string> = {}) {
  return NextResponse.json(corpo, { status, headers: { 'Cache-Control': cache, ...extra } })
}
const naoEncontrada = () => resposta({ error: 'Partida não encontrada.' }, 404, SEM_CACHE)

export async function GET(req: NextRequest, { params }: { params: Promise<{ partidaId: string }> }) {
  if (!aoVivoAtivo()) return resposta({ error: 'Recurso não encontrado.' }, 404, SEM_CACHE)

  const cota = consumirLimite(`ao-vivo:ip:${ipDaRequisicao(req)}`, LIMITE_POR_MINUTO, 60_000)
  if (!cota.ok) {
    return resposta({ error: 'Muitas requisições. Aguarde um instante.', codigo: 'LIMITE_EXCEDIDO' }, 429, SEM_CACHE, {
      'Retry-After': String(cota.retryAfterSeconds),
    })
  }

  const { partidaId } = await params
  const id = idDePartidaAoVivo(partidaId)
  if (id == null) return naoEncontrada()

  try {
    const r = await lerAoVivo(cliente, id, {
      configDaPartida: async (partida) => configDaPartida(await regrasEfetivasDaPartida(partida)),
      campeonatoPublicado: campeonatoPublicadoDaLiga,
      eventosAtivos: sumulaEventosAtivo(),
    })
    if (r.tipo === 'NAO_ENCONTRADO') return naoEncontrada()
    if (r.tipo === 'ERRO') return resposta({ error: 'Não foi possível abrir o acompanhamento ao vivo.' }, 500, SEM_CACHE)
    return resposta({ data: r.payload }, 200, CACHE_CONTROL_AO_VIVO)
  } catch {
    return resposta({ error: 'Não foi possível abrir o acompanhamento ao vivo.' }, 500, SEM_CACHE)
  }
}
