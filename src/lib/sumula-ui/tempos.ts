/**
 * Tempos: o rótulo da tela é "Tempo" (sem "técnico"; o tempo técnico indoor é [M] e fica desligado)
 * e o limite padrão é o do motor (2 por set). Módulo PURO.
 */
import { LIMITE_OFICIAL_TEMPOS } from '@/lib/regras-volei'
import { caixaDeBloqueio, type CaixaRegra } from './explicacao'

export const ROTULO_TEMPO = 'Tempo'

export function textoTempo(equipe: string, usados: number, set: number, limite: number = LIMITE_OFICIAL_TEMPOS) {
  return `Tempo solicitado por ${equipe} (${usados}/${limite} no set ${set}).`
}

/** Limite da equipe no set: o configurado pela categoria, ou o do motor. */
export function limiteDeTemposDaTela(configurado: unknown): number {
  const n = Number(configurado)
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : LIMITE_OFICIAL_TEMPOS
}

export function avaliarTempo(usados: number, limite: number, equipe: string): { ok: true; aviso: string | null } | { ok: false; caixa: CaixaRegra } {
  if (usados >= limite) {
    return {
      ok: false,
      caixa: caixaDeBloqueio('RG-TMP-001', `${equipe} já usou os ${limite} tempos do set.`),
    }
  }
  const aviso = limite > LIMITE_OFICIAL_TEMPOS ? `Esta categoria permite ${limite} tempos por set, acima dos ${LIMITE_OFICIAL_TEMPOS} do padrão FIVB/CBV.` : null
  return { ok: true, aviso }
}
