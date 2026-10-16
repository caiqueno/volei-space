/**
 * Tipos base do motor de regras de vôlei (módulo PURO: sem Next, sem Supabase,
 * sem I/O). Toda regra devolve um ResultadoRegra explicável ao apontador.
 */

export type Equipe = 'A' | 'B'

/** Código da regra (ver docs/analise/03-regras-validaveis.md). Ex.: 'RG-SUB-001'. */
export type CodigoRegra = `RG-${string}-${string}`

export interface AvisoRegra {
  codigo: CodigoRegra
  mensagem: string
}

export interface RegraOk {
  ok: true
  /** Regra respeitada, mas com ressalva (ex.: perfil amador acima do limite oficial). */
  avisos: AvisoRegra[]
}

export interface RegraBloqueio {
  ok: false
  codigo: CodigoRegra
  mensagem: string
}

export type ResultadoRegra = RegraOk | RegraBloqueio

export function ok(avisos: AvisoRegra[] = []): RegraOk {
  return { ok: true, avisos }
}

export function bloqueio(codigo: CodigoRegra, mensagem: string): RegraBloqueio {
  return { ok: false, codigo, mensagem }
}

export function aviso(codigo: CodigoRegra, mensagem: string): AvisoRegra {
  return { codigo, mensagem }
}

export function outraEquipe(equipe: Equipe): Equipe {
  return equipe === 'A' ? 'B' : 'A'
}

export interface PlacarSet {
  a: number
  b: number
}

/** Formação em quadra: índice 0 = posição I (saque), 1 = II, 2 = III, 3 = IV, 4 = V, 5 = VI. */
export type Formacao = readonly number[]
