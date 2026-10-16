/**
 * Traduz as regras efetivas da partida (categoria/liga) para a `ConfigPartida` do motor.
 * Função pura: quem carrega as regras do banco é a camada Supabase.
 */
import {
  CONFIG_FIVB_MELHOR_DE_5,
  LIMITE_OFICIAL_SUBSTITUICOES,
  LIMITE_OFICIAL_TEMPOS,
  PERFIL_FIVB_CBV,
  type ConfigPartida,
  type PerfilRegras,
} from '@/lib/regras-volei'
import { LIMITE_SUBSTITUICOES_POR_SET, limiteDeSubstituicoes } from '@/lib/sumula-regras'
import type { CategoryMatchRules } from '@/lib/category-match-rules'

function inteiroPositivo(valor: unknown, padrao: number): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : padrao
}

/**
 * Até o limite oficial (6) vale o perfil FIVB/CBV (par A-B bloqueado). Acima dele, como o padrão
 * atual da súmula (8), vale o perfil amador: par repetido com aviso de ilegalidade FIVB/CBV.
 */
export function perfilDaPartida(regras: Partial<CategoryMatchRules>): PerfilRegras {
  const bruto = regras.limiteSubstituicoesPorSet
  const limite = bruto == null ? LIMITE_SUBSTITUICOES_POR_SET : limiteDeSubstituicoes(bruto)
  const temposPorSet = inteiroPositivo(regras.limiteTemposPorSet, LIMITE_OFICIAL_TEMPOS)
  if (limite <= LIMITE_OFICIAL_SUBSTITUICOES) {
    return { ...PERFIL_FIVB_CBV, id: 'LIGA_FIVB', limiteSubstituicoesPorSet: limite, temposPorSet }
  }
  return {
    id: 'LIGA_AMADOR',
    limiteSubstituicoesPorSet: limite,
    alertarAcimaDoOficial: true,
    permitirParRepetido: true,
    temposPorSet,
  }
}

export function configDaPartida(regras: Partial<CategoryMatchRules>): ConfigPartida {
  const alvoSet = inteiroPositivo(regras.pontosPorSet, 21)
  const alvoSetDecisivo = regras.tieBreakUltimoSet === true ? inteiroPositivo(regras.pontosUltimoSet, 15) : alvoSet
  return {
    ...CONFIG_FIVB_MELHOR_DE_5,
    perfil: perfilDaPartida(regras),
    // O motor só conhece melhor de 3 ou de 5; qualquer valor menor vira melhor de 3.
    melhorDe: inteiroPositivo(regras.setsPorPartida, 3) >= 5 ? 5 : 3,
    alvoSet,
    alvoSetDecisivo,
    terceiroSetObrigatorio: regras.terceiroSetObrigatorio === true,
    trocaLadoNoDecisivoEm: Math.ceil(alvoSetDecisivo / 2),
  }
}
