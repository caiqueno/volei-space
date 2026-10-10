import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import type { MatchEstimate, MatchEstimateInput } from './types'

const INDISPONIVEL: MatchEstimate = { disponivel: false, total: 0, faseDeGrupos: 0, eliminatorias: 0 }

function temFaseDeGrupos(formato?: string | null): boolean {
  return formato !== 'MATA_MATA' && formato !== 'COPA_CURTA'
}

// Round-robin dentro de cada grupo, com as equipes distribuídas o mais
// uniformemente possível — mesma regra que buildGroupMatches aplica de fato
// ao gerar os confrontos (loop i<j por grupo, espelhado quando turnoReturno).
function contarPartidasDeGrupos(equipes: number, grupos: number, turnoReturno: boolean): number {
  const base = Math.floor(equipes / grupos)
  const resto = equipes % grupos

  let total = 0
  for (let i = 0; i < grupos; i += 1) {
    const tamanho = i < resto ? base + 1 : base
    total += (tamanho * (tamanho - 1)) / 2
  }

  return turnoReturno ? total * 2 : total
}

/**
 * Estimativa de partidas a partir da configuração — usada pelo preço e pela
 * Prévia. É sempre uma PREVISÃO: as partidas reais são geradas depois, com
 * as equipes efetivamente aprovadas.
 *
 * Ida e volta do mata-mata dobra só os jogos da chave. Sem o flag, a
 * estimativa continua um jogo por confronto.
 */
export function estimateMatchCount(input: MatchEstimateInput): MatchEstimate {
  const formato = input.formato
  if (!formato) return INDISPONIVEL

  const equipes = Number(input.quantidadeEquipes ?? 0)
  const comGrupos = temFaseDeGrupos(formato)

  if (comGrupos && equipes < 2) return INDISPONIVEL

  const grupos = Math.max(1, Number(input.quantidadeGrupos ?? 1))
  const faseDeGrupos = comGrupos
    ? contarPartidasDeGrupos(equipes, Math.min(grupos, equipes), Boolean(input.turnoReturno))
    : 0

  const vagas = getRequiredEliminatoryTeams(input.faseEliminatoria)
  let eliminatorias = 0
  if (vagas > 0) {
    // Eliminação simples: R equipes produzem R-1 confrontos até o título.
    eliminatorias = vagas - 1
    // Disputa de 3º só existe quando a chave passa por uma semifinal.
    if (input.disputaTerceiroLugar && vagas >= 4) eliminatorias += 1
    if (input.eliminatoriaIdaVolta) eliminatorias *= 2
  }

  if (!comGrupos && eliminatorias === 0) return INDISPONIVEL

  return {
    disponivel: true,
    total: faseDeGrupos + eliminatorias,
    faseDeGrupos,
    eliminatorias,
  }
}
