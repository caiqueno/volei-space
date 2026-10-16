import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'
import { verifyPublicToken } from '@/lib/auth'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'
import { lerPartidaSumula, organizadorDaLiga } from '@/lib/partida-operacao'

export type SumulaTokenAccess = {
  partida: any
}

/** Resposta única para token inexistente e para Partida.id numérico. */
const PARTIDA_NAO_ENCONTRADA = 'Partida não encontrada.'

/**
 * A credencial é só o `sumulaToken` opaco. Partida.id numérico não é credencial:
 * a leitura pública por id vive em /api/partidas/{id}/sumula-publica, limitada
 * a campeonato publicado e sem dados pessoais.
 */
export async function requireSumulaTokenAccess(token: string): Promise<SumulaTokenAccess | NextResponse> {
  if (!tokenOpacoValido(token)) return error(PARTIDA_NAO_ENCONTRADA, 404)
  const { partida, error: partidaErr } = await lerPartidaSumula({ coluna: 'sumulaToken', valor: token })

  if (partidaErr) return error('Não foi possível abrir a súmula.', 500)
  if (!partida) return error(PARTIDA_NAO_ENCONTRADA, 404)
  if (partida.sumulaTokenExpira && new Date(partida.sumulaTokenExpira).getTime() < Date.now()) {
    return error('O link da súmula expirou.', 410)
  }
  return { partida }
}

/** Token opaco: nunca só dígitos (seria Partida.id) e só caracteres de token. */
export function tokenOpacoValido(token: string) {
  return /^[A-Za-z0-9_-]{1,200}$/.test(token) && !/^\d+$/.test(token)
}

export async function requireSumulaLeitura(req: NextRequest, partida: any): Promise<NextResponse | null> {
  const acesso = await lerSessaoAcesso(req)
  if (acesso && Number(acesso.partidaId) === Number(partida.id)) {
    const { data: link } = await supabase
      .from('AcessoArbitroJogo')
      .select('id,token,ativo,revogadoEm')
      .eq('id', acesso.acessoId)
      .maybeSingle()
    if (link && link.ativo && !link.revogadoEm && link.token === acesso.token) return null
  }

  const sessao = await verifyPublicToken(req)
  if (!sessao) return error('Entre para abrir a súmula.', 401)

  // O organizadorId não vem dentro da partida; a posse é lida à parte.
  if (sessao.tipo === 'organizador' && (await organizadorDaLiga(partida.ligaId)) === sessao.userId) return null

  if (sessao.tipo === 'arbitro') {
    const { data: conta } = await supabase
      .from('CandidaturaArbitro')
      .select('arbitroId,status')
      .eq('id', sessao.userId)
      .maybeSingle()
    const escala = Array.isArray(partida.escala) ? partida.escala : []
    const escalado = escala.some((item: { arbitroId?: number }) => Number(item.arbitroId) === Number(conta?.arbitroId))
    if (!conta?.arbitroId || !escalado) return error('Você não está escalado para esta súmula.', 403)
    return null
  }

  return error('Você não pode abrir esta súmula.', 403)
}
