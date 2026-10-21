// Entrada comum das rotas NOVAS do pagamento por comprovante (R19).
// Flag própria PAGAMENTO_COMPROVANTE_ATIVO=1; desligada, 404 antes de qualquer outra coisa.
// Organizador: sessão liberada + papel conferido no servidor (dono/ADMINISTRADOR escrevem; FINANCEIRO decide pagamento;
// ARBITRAGEM só lê). Campeonato de outra organização = 404 (IDOR). Líder: sessão de equipe + MEU_TIME_ATIVO.
import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { requireOrganizador } from '@/lib/organizador-isolamento'
import { ErroMeuTime, falha, rotaMeuTime, type ContextoRota } from '@/lib/meu-time/acesso'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { pagamentoComprovanteAtivo } from './config'

export type ContextoOrganizadorPagamento<P> = { req: NextRequest; usuarioId: string; params: P }

function traduzir(erro: unknown) {
  if (erro instanceof ErroMeuTime) {
    const resposta = falha(erro.message, erro.status, erro.codigo, erro.extra)
    const espera = erro.extra?.retryAfterSeconds
    if (typeof espera === 'number') resposta.headers.set('Retry-After', String(espera))
    return resposta
  }
  console.error('[pagamento-comprovante] erro inesperado', erro instanceof Error ? erro.name : 'desconhecido')
  return falha('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Dados de pagamento e comprovante nunca ficam em cache de navegador nem de proxy. */
export function semCache<T extends Response>(resposta: T): T {
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}

/** Rota do organizador: flag (404), sessão liberada (401/403), limite por usuário (429) e tradução de erros. */
export function rotaPagamentoOrganizador<P = Record<string, never>>(
  escopo: string,
  manipulador: (contexto: ContextoOrganizadorPagamento<P>) => Promise<Response>,
) {
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!pagamentoComprovanteAtivo()) return falha('Não encontrado.', 404)
    const auth = await requireOrganizador(req)
    if (auth instanceof NextResponse || auth instanceof Response) return auth
    try {
      await limitarUsuario(req, `pagamento-${escopo}`, String(auth.userId), req.method === 'GET' ? 60 : 20)
      const params = (await Promise.resolve(argumentos?.params ?? {})) as P
      return semCache(await manipulador({ req, usuarioId: String(auth.userId), params }))
    } catch (erro) {
      return traduzir(erro)
    }
  }
}

/** Rota do líder/técnico: flag do pagamento (404) somada a MEU_TIME_ATIVO e à sessão de equipe (rotaMeuTime). */
export function rotaPagamentoLider<P = Record<string, never>>(
  escopo: string,
  manipulador: (contexto: ContextoRota<P>) => Promise<Response>,
) {
  const interna = rotaMeuTime<P>(async (contexto) => {
    await limitarUsuario(contexto.req, `pagamento-lider-${escopo}`, contexto.usuarioId, contexto.req.method === 'GET' ? 60 : 20)
    return semCache(await manipulador(contexto))
  })
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!pagamentoComprovanteAtivo()) return falha('Não encontrado.', 404)
    const params = (await Promise.resolve(argumentos?.params ?? {})) as P
    return interna(req, { params })
  }
}

/** Valida com Zod (aceita schemas com transformação). A primeira mensagem vira o `error`; o detalhe vai em `erros`. */
export function validarCorpo<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const resultado = schema.safeParse(corpo)
  if (resultado.success) return resultado.data
  const primeira = resultado.error.issues[0]
  const campo = primeira?.path.join('.')
  throw new ErroMeuTime(
    campo ? `Dados inválidos em "${campo}": ${primeira.message}` : `Dados inválidos: ${primeira?.message ?? 'corpo vazio'}`,
    422,
    'DADOS_INVALIDOS',
    { erros: resultado.error.issues.map((item) => ({ campo: item.path.join('.'), mensagem: item.message })) },
  )
}
