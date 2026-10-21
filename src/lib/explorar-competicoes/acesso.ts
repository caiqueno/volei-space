// Entrada das rotas de "Explorar competições" (R18). Flag: EXPLORAR_COMPETICOES_ATIVO=1 (desligada = 404).
// Além da flag, vale a do Meu Time (MEU_TIME_ATIVO=1) e a sessão de equipe (líder, técnico ou assistente).
import { NextRequest } from 'next/server'
import { ErroMeuTime, falha, rotaMeuTime, tabelaAusente, type ContextoRota } from '@/lib/meu-time/acesso'

export const MENSAGEM_EXPLORAR_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

type ErroBanco = { code?: string | null; message?: string | null } | null | undefined

/** Devolve os dados ou interrompe a rota: 503 se a tabela/coluna não existe neste ambiente, 500 genérico nos demais erros. */
export function lerExplorar<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (tabelaAusente(resultado.error) || resultado.error.code === '42703') {
    throw new ErroMeuTime(MENSAGEM_EXPLORAR_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
  }
  console.error(`[explorar-competicoes] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

export function explorarAtivo(env: Record<string, string | undefined> = process.env) {
  return env.EXPLORAR_COMPETICOES_ATIVO === '1'
}

export function rotaExplorar<P = Record<string, never>>(manipulador: (contexto: ContextoRota<P>) => Promise<Response>) {
  const interna = rotaMeuTime<P>(manipulador)
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!explorarAtivo()) return falha('Não encontrado.', 404)
    return interna(req, argumentos)
  }
}
