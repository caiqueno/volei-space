/**
 * Autenticação do app de banco.
 *  - Lado do banco: token opaco do link (BancoAcesso.tokenHash), com limite por IP e por token,
 *    comparação em tempo constante, expiração e revogação. O acesso vale para UMA equipe de UMA partida.
 *  - Lado do apontador: a mesma autenticação da súmula (requireSumulaTokenAccess + requireArbitroPartidaAccess),
 *    usadas como estão.
 */
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumirLimiteAsync, ipDaRequisicao, modoDeFalhaDoMetodo } from '@/lib/rate-limit'
import { requireSumulaTokenAccess } from '@/lib/sumula-access'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import {
  bancoAppAtivo,
  falhaBanco,
  hashesIguais,
  hashTokenBanco,
  indisponivelBanco,
  naoEncontradoBanco,
  respostaErro,
  tokenBancoValido,
} from './base'
import { conferir, lerPartidaBanco, TabelaBancoAusenteErro, type PartidaBanco } from './dados'

const db = supabaseAdmin as any

export type AcessoBanco = {
  acessoId: string
  partida: PartidaBanco
  equipeId: number
}

/**
 * Limite por IP: consome UMA vez por requisição (antes o balde do IP era gasto duas vezes).
 * Usa o store persistente (Supabase) com fallback em memória (rate-limit.ts). Se o limitador falhar,
 * leitura segue (falha-aberto) e escrita é recusada (falha-fechado).
 */
export async function limitadoPorIp(req: NextRequest): Promise<NextResponse | null> {
  const ip = await consumirLimiteAsync(`banco:ip:${ipDaRequisicao(req)}`, 120, 60_000, modoDeFalhaDoMetodo(req.method))
  if (!ip.ok) return respostaErro('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: ip.retryAfterSeconds })
  return null
}

/** Balde por token: só depois de validar o formato (token malformado não cria balde). */
async function limitadoPorToken(chaveToken: string, metodo: string): Promise<NextResponse | null> {
  const t = await consumirLimiteAsync(`banco:tk:${chaveToken}`, 90, 60_000, modoDeFalhaDoMetodo(metodo))
  if (!t.ok) return respostaErro('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: t.retryAfterSeconds })
  return null
}

/** Resolve o link do banco. Devolve a resposta de erro pronta quando o acesso não vale. */
export async function resolverAcessoBanco(req: NextRequest, token: string): Promise<AcessoBanco | NextResponse> {
  if (!bancoAppAtivo()) return naoEncontradoBanco()
  const bloqueado = await limitadoPorIp(req)
  if (bloqueado) return bloqueado
  if (!tokenBancoValido(token)) return respostaErro('Link inválido.', 404, 'LINK_INVALIDO')
  const hash = hashTokenBanco(token)
  const porToken = await limitadoPorToken(hash.slice(0, 24), req.method)
  if (porToken) return porToken

  try {
    const acesso = conferir(
      await db.from('BancoAcesso').select('id,partidaId,equipeId,tokenHash,expiraEm,revogadoEm').eq('tokenHash', hash).maybeSingle(),
    ) as any
    if (!acesso || !hashesIguais(acesso.tokenHash, hash)) return respostaErro('Link inválido.', 404, 'LINK_INVALIDO')
    if (acesso.revogadoEm) return respostaErro('Este link do banco foi revogado.', 410, 'LINK_REVOGADO')
    if (acesso.expiraEm && new Date(acesso.expiraEm).getTime() <= Date.now()) {
      return respostaErro('Este link do banco expirou.', 410, 'LINK_EXPIRADO')
    }
    const partida = await lerPartidaBanco(Number(acesso.partidaId))
    if (!partida) return respostaErro('Link inválido.', 404, 'LINK_INVALIDO')
    const equipeId = Number(acesso.equipeId)
    if (equipeId !== partida.equipeAId && equipeId !== partida.equipeBId) return respostaErro('Link inválido.', 404, 'LINK_INVALIDO')
    return { acessoId: String(acesso.id), partida, equipeId }
  } catch (e) {
    return e instanceof TabelaBancoAusenteErro ? indisponivelBanco() : falhaBanco()
  }
}

export type AcessoApontador = {
  partida: PartidaBanco
  /** Quem decidiu, para auditoria (usuário da sessão ou id do link do jogo). */
  usuarioId: string
}

/** Apontador/árbitro/organizador da partida, pela mesma autenticação da súmula. */
export async function resolverApontador(req: NextRequest, sumulaToken: string): Promise<AcessoApontador | NextResponse> {
  if (!bancoAppAtivo()) return naoEncontradoBanco()
  const bloqueado = await limitadoPorIp(req)
  if (bloqueado) return bloqueado
  const base = await requireSumulaTokenAccess(sumulaToken)
  if (base instanceof Response) return base as NextResponse
  const acesso = await requireArbitroPartidaAccess(req, sumulaToken)
  if (acesso instanceof Response) return acesso as NextResponse
  try {
    const partida = await lerPartidaBanco(Number(acesso.partida.id))
    if (!partida) return respostaErro('Partida não encontrada.', 404)
    return { partida, usuarioId: String(acesso.auth.userId) }
  } catch {
    return falhaBanco()
  }
}

/** Converte exceções de tabela ausente em 503 e o resto em 500. */
export function respostaDeExcecao(e: unknown): NextResponse {
  return e instanceof TabelaBancoAusenteErro ? indisponivelBanco() : falhaBanco()
}
