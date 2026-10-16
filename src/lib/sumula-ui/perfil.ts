/**
 * Perfil de regras da súmula. O padrão atual da tela é 8 substituições por set, com aviso acima
 * de 6 ("fora do padrão FIVB/CBV"). Quando a categoria/campeonato configura 6 ou menos, vale o
 * perfil FIVB/CBV (sem repetir par). Módulo PURO.
 */
import { LIMITE_OFICIAL_SUBSTITUICOES, LIMITE_OFICIAL_TEMPOS, PERFIL_AMADOR, PERFIL_FIVB_CBV, type PerfilRegras } from '@/lib/regras-volei'

export const LIMITE_PADRAO_DA_TELA = 8

export function perfilDaSumula(limiteSubstituicoes: unknown): PerfilRegras {
  const numero = Number(limiteSubstituicoes)
  const limite = Number.isInteger(numero) && numero >= 1 && numero <= 30 ? numero : LIMITE_PADRAO_DA_TELA
  const base = limite <= LIMITE_OFICIAL_SUBSTITUICOES ? PERFIL_FIVB_CBV : PERFIL_AMADOR
  return { ...base, limiteSubstituicoesPorSet: limite, temposPorSet: LIMITE_OFICIAL_TEMPOS }
}

export function rotuloDoPerfil(perfil: PerfilRegras): string {
  return perfil.id === PERFIL_FIVB_CBV.id ? 'Perfil FIVB/CBV' : 'Perfil amador (padrão da súmula)'
}
