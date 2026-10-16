import type { NextRequest } from 'next/server'
import { verifyPublicToken, verifyToken } from '@/lib/auth'
import { campeonatoPublicado } from '@/lib/campeonato-publico'

type LigaParaLeitura = { status?: unknown; simulacao?: unknown; organizadorId?: string | null }

/**
 * Leitura de um campeonato por quem pode enxergá-lo.
 * Visitante só vê campeonato publicado e não simulado; o organizador dono e o
 * administrador também enxergam rascunho e simulação (do próprio campeonato).
 */
export async function podeLerCampeonato(req: NextRequest, liga: LigaParaLeitura | null | undefined): Promise<boolean> {
  if (!liga) return false
  if (campeonatoPublicado(liga)) return true
  const [sessao, admin] = await Promise.all([verifyPublicToken(req), verifyToken(req)])
  if (admin) return true
  return Boolean(sessao && sessao.tipo === 'organizador' && liga.organizadorId && sessao.userId === liga.organizadorId)
}
