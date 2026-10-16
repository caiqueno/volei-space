// Entrada comum das rotas do Meu Time: flag, sessão, erros e envelope de resposta.
// Regra de produto: toda validação e toda permissão acontecem aqui, no servidor.
import { NextRequest, NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import { requirePublicRole } from '@/lib/auth'

export const MENSAGEM_NAO_HABILITADO = 'Meu Time ainda não está habilitado neste ambiente.'

/** Desligado por padrão: sem MEU_TIME_ATIVO=1 as rotas respondem 404, como se não existissem. */
export function meuTimeAtivo() {
  return process.env.MEU_TIME_ATIVO === '1'
}

export class ErroMeuTime extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(mensagem)
    // Com target ES5, `instanceof` de subclasse de Error só funciona se o protótipo for refeito.
    Object.setPrototypeOf(this, ErroMeuTime.prototype)
  }
}

export function falha(mensagem: string, status: number, codigo?: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: mensagem, ...(codigo ? { codigo } : {}), ...(extra ?? {}) }, { status })
}

export function sucesso<T>(data: T, status = 200, extra?: Record<string, unknown>) {
  return NextResponse.json({ data, ...(extra ?? {}) }, { status })
}

type ErroBanco = { code?: string | null; message?: string | null } | null | undefined

/** Tabela das migrations pendentes ainda não existe no banco real. */
export function tabelaAusente(erro: ErroBanco) {
  if (!erro) return false
  if (erro.code === '42P01' || erro.code === 'PGRST205') return true
  return /relation .* does not exist|Could not find the table/i.test(String(erro.message ?? ''))
}

export function violacaoUnica(erro: ErroBanco) {
  return erro?.code === '23505'
}

/** Devolve os dados ou interrompe a rota: 503 se a tabela não existe, 500 genérico nos demais erros. */
export function lerDados<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (tabelaAusente(resultado.error)) throw new ErroMeuTime(MENSAGEM_NAO_HABILITADO, 503)
  console.error(`[meu-time] ${onde}`, resultado.error.code ?? '', resultado.error.message ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function idValido(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor)
}

export type ContextoRota<P> = {
  req: NextRequest
  usuarioId: string
  nomeUsuario: string
  params: P
}

type Manipulador<P> = (contexto: ContextoRota<P>) => Promise<Response>

/**
 * Envolve uma rota do Meu Time: 404 com a flag desligada, 401 sem sessão pública de equipe,
 * e traduz ErroMeuTime em `{ error, codigo? }`.
 */
export function rotaMeuTime<P = Record<string, never>>(manipulador: Manipulador<P>) {
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!meuTimeAtivo()) return falha('Não encontrado.', 404)
    const auth = await requirePublicRole(req, ['equipe'])
    if (auth instanceof Response) return auth
    try {
      return await manipulador({
        req,
        usuarioId: auth.userId,
        nomeUsuario: auth.nome,
        params: (argumentos?.params ?? {}) as P,
      })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) return falha(erro.message, erro.status, erro.codigo, erro.extra)
      console.error('[meu-time] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}

/** Valida o corpo com Zod; a primeira mensagem vira o `error`, o detalhe vai em `erros`. */
export function validar<T>(schema: ZodType<T>, corpo: unknown): T {
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

export async function lerCorpo(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ErroMeuTime('Corpo da requisição inválido.', 400, 'CORPO_INVALIDO')
  }
}
