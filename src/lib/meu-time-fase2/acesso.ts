// Entrada comum das rotas da fase 2 do Meu Time (convites, importação, clube, notificações).
// Flags: MEU_TIME_ATIVO=1 (já existente) E MEU_TIME_FASE2_ATIVO=1. Qualquer uma desligada = 404.
// Tabelas das migrations pendentes ausentes = 503 "Recurso ainda não habilitado neste ambiente.".
import { NextRequest, NextResponse } from 'next/server'
import { ErroMeuTime, falha, meuTimeAtivo, rotaMeuTime, tabelaAusente, type ContextoRota } from '@/lib/meu-time/acesso'

export const MENSAGEM_FASE2_NAO_HABILITADA = 'Recurso ainda não habilitado neste ambiente.'

export function fase2Ativa() {
  return process.env.MEU_TIME_FASE2_ATIVO === '1'
}

type ErroBanco = { code?: string | null; message?: string | null } | null | undefined

/** Devolve os dados ou interrompe a rota: 503 se a tabela não existe, 500 genérico nos demais erros. */
export function lerFase2<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (tabelaAusente(resultado.error)) throw new ErroMeuTime(MENSAGEM_FASE2_NAO_HABILITADA, 503, 'RECURSO_NAO_HABILITADO')
  console.error(`[meu-time-fase2] ${onde}`, resultado.error.code ?? '', resultado.error.message ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Rota autenticada da fase 2: flag da fase 2 antes de qualquer outra coisa. */
export function rotaFase2<P = Record<string, never>>(manipulador: (contexto: ContextoRota<P>) => Promise<Response>) {
  const interna = rotaMeuTime<P>(manipulador)
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!meuTimeAtivo() || !fase2Ativa()) return falha('Não encontrado.', 404)
    return interna(req, argumentos)
  }
}

/** Rota pública (sem sessão), com as mesmas flags e tradução de ErroMeuTime. */
export function rotaFase2Publica<P = Record<string, never>>(manipulador: (contexto: { req: NextRequest; params: P }) => Promise<Response>) {
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!meuTimeAtivo() || !fase2Ativa()) return falha('Não encontrado.', 404)
    try {
      return await manipulador({ req, params: (argumentos?.params ?? {}) as P })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) {
        const resposta = falha(erro.message, erro.status, erro.codigo, erro.extra)
        const espera = erro.extra?.retryAfterSeconds
        if (typeof espera === 'number') (resposta as NextResponse).headers.set('Retry-After', String(espera))
        return resposta
      }
      console.error('[meu-time-fase2] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}
