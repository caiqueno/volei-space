// Entrada comum das rotas NOVAS da rodada 17 (elenco completo): uploads do Meu Time, dados do atleta e do time,
// regras de elenco e pedido de troca. Flag própria ELENCO_COMPLETO_ATIVO=1, somada a MEU_TIME_ATIVO=1.
// Desligada, as rotas novas respondem 404 como se não existissem e as existentes não mudam de comportamento.
// Coluna ou tabela das migrations pendentes ausente = 503 "Recurso ainda não habilitado neste ambiente.", nunca 500.
import { NextRequest } from 'next/server'
import { colunaAusente } from '@/lib/coluna-ausente'
import { requireOrganizador } from '@/lib/organizador-isolamento'
import { ErroMeuTime, falha, meuTimeAtivo, rotaMeuTime, tabelaAusente, type ContextoRota } from '@/lib/meu-time/acesso'

export const MENSAGEM_ELENCO_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

export function elencoCompletoAtivo(env: Record<string, string | undefined> = process.env) {
  return env.ELENCO_COMPLETO_ATIVO === '1'
}

/** Colunas e tabelas criadas pela migration da rodada 17. Se alguma faltar no banco real, o erro vira 503. */
export const COLUNAS_ELENCO = [
  'cpfCifrado',
  'cpfHash',
  'documentoTipo',
  'documentoHash',
  'documentoNumeroCifrado',
  'telefoneCifrado',
  'telefoneEmergenciaCifrado',
  'fotoRostoPath',
  'documentoPath',
  'fotoRostoEnviadaEm',
  'documentoEnviadoEm',
  'contatoEmail',
  'contatoTelefoneCifrado',
  'corPrimaria',
  'corSecundaria',
  'escudoPath',
  'motivoRecusa',
  'decididoPor',
  'decididoEm',
  'prazoTrocaEm',
  'exigeConsentimentoMenor',
] as const

type ErroBanco = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

export function recursoElencoAusente(erro: ErroBanco) {
  if (!erro) return false
  return tabelaAusente(erro) || erro.code === '42703' || erro.code === 'PGRST204' || colunaAusente(erro, COLUNAS_ELENCO)
}

export function indisponivelElenco() {
  return new ErroMeuTime(MENSAGEM_ELENCO_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

/** Devolve os dados ou interrompe a rota: 503 se o recurso não existe neste banco, 500 genérico nos demais erros. */
export function lerElenco<T>(resultado: { data: T | null; error: ErroBanco }, onde: string): T | null {
  if (!resultado.error) return resultado.data
  if (recursoElencoAusente(resultado.error)) throw indisponivelElenco()
  console.error(`[elenco] ${onde}`, resultado.error.code ?? '', resultado.error.message ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Rota do líder/técnico (sessão de equipe) atrás das duas flags. */
export function rotaElencoLider<P = Record<string, never>>(manipulador: (contexto: ContextoRota<P>) => Promise<Response>) {
  const interna = rotaMeuTime<P>(manipulador)
  return async (req: NextRequest, argumentos?: { params?: P }): Promise<Response> => {
    if (!elencoCompletoAtivo()) return falha('Não encontrado.', 404)
    return interna(req, argumentos)
  }
}

export type ContextoOrganizadorElenco<P> = { req: NextRequest; organizadorId: string; params: P }

/** Rota do organizador (sessão liberada) atrás das duas flags. Flag desligada = 404 antes de qualquer outra coisa. */
export function rotaElencoOrganizador<P = Record<string, never>>(manipulador: (contexto: ContextoOrganizadorElenco<P>) => Promise<Response>) {
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!elencoCompletoAtivo() || !meuTimeAtivo()) return falha('Não encontrado.', 404)
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
      console.error('[elenco] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}
