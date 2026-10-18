// Entrada comum das rotas de solicitação de inscrição (R14).
// Flag própria: INSCRICAO_SOLICITACAO_ATIVO=1. Desligada, tudo responde 404 como se a rota não existisse.
// Líder: além da flag, MEU_TIME_ATIVO=1 (rotaMeuTime). Organizador: sessão de organizador liberada.
// Tabela/coluna das migrations pendentes ausente = 503 "Recurso ainda não habilitado neste ambiente.".
import { NextRequest } from 'next/server'
import { colunaAusente } from '@/lib/coluna-ausente'
import { consumirLimiteAsync, ipDaRequisicao, modoDeFalhaDoMetodo } from '@/lib/rate-limit'
import { requireOrganizador } from '@/lib/organizador-isolamento'
import { ErroMeuTime, falha, rotaMeuTime, tabelaAusente, type ContextoRota } from '@/lib/meu-time/acesso'

export const MENSAGEM_SOLICITACAO_NAO_HABILITADA = 'Recurso ainda não habilitado neste ambiente.'

export function solicitacaoAtiva(env: Record<string, string | undefined> = process.env) {
  return env.INSCRICAO_SOLICITACAO_ATIVO === '1'
}

type ErroBanco = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

/** Coluna nova (modoInscricao) ou tabela nova ainda não existe neste banco. */
export function recursoAusente(erro: ErroBanco) {
  return tabelaAusente(erro) || colunaAusente(erro, ['modoInscricao', 'SolicitacaoInscricao', 'atletasEscolhidos'])
}

export function indisponivel() {
  return new ErroMeuTime(MENSAGEM_SOLICITACAO_NAO_HABILITADA, 503, 'RECURSO_NAO_HABILITADO')
}

/** Devolve os dados ou interrompe a rota: 503 se o recurso não existe, 500 genérico nos demais erros. */
export function lerSolic<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (recursoAusente(resultado.error)) throw indisponivel()
  console.error(`[inscricoes-solicitacao] ${onde}`, resultado.error.code ?? '', resultado.error.message ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Limite por usuário e IP nas escritas (falha-fechado) e leituras (falha-aberto). */
export async function limitarUsuario(req: NextRequest, escopo: string, usuarioId: string, limite = 30) {
  const modo = modoDeFalhaDoMetodo(req.method)
  const porUsuario = await consumirLimiteAsync(`solic:${escopo}:u:${usuarioId}`, limite, 60_000, modo)
  if (!porUsuario.ok) {
    throw new ErroMeuTime('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: porUsuario.retryAfterSeconds })
  }
  const porIp = await consumirLimiteAsync(`solic:${escopo}:ip:${ipDaRequisicao(req)}`, limite * 4, 60_000, modo)
  if (!porIp.ok) {
    throw new ErroMeuTime('Muitas requisições. Aguarde um instante.', 429, 'LIMITE_EXCEDIDO', { retryAfterSeconds: porIp.retryAfterSeconds })
  }
}

/** Rota do líder/técnico (sessão de equipe do Meu Time) atrás da flag das solicitações. */
export function rotaLider<P = Record<string, never>>(manipulador: (contexto: ContextoRota<P>) => Promise<Response>) {
  const interna = rotaMeuTime<P>(manipulador)
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!solicitacaoAtiva()) return falha('Não encontrado.', 404)
    return interna(req, argumentos)
  }
}

export type ContextoOrganizador<P> = { req: NextRequest; organizadorId: string; params: P }

/** Rota do organizador (sessão de organizador liberada). Flag desligada = 404 antes de qualquer outra coisa. */
export function rotaOrganizador<P = Record<string, never>>(manipulador: (contexto: ContextoOrganizador<P>) => Promise<Response>) {
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!solicitacaoAtiva()) return falha('Não encontrado.', 404)
    const auth = await requireOrganizador(req)
    if (auth instanceof Response) return auth
    try {
      const params = (await Promise.resolve(argumentos?.params ?? {})) as P
      return await manipulador({ req, organizadorId: String(auth.userId), params })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) {
        const resposta = falha(erro.message, erro.status, erro.codigo, erro.extra)
        const espera = erro.extra?.retryAfterSeconds
        if (typeof espera === 'number') resposta.headers.set('Retry-After', String(espera))
        return resposta
      }
      console.error('[inscricoes-solicitacao] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}
