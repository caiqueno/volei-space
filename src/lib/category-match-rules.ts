/**
 * Validação pura do placar de sets segundo a configuração da categoria.
 * Os exemplos de `brain/03 - Súmula Digital/Fechamento de Set.md` passam com alvo 21.
 * O formato único de 3 sets de 21 de `brain/02 - Regulamento e Regras da Liga/Formato da Temporada.md`
 * não está fixado nesta função.
 */
export type CategorySet = { numero: number; pontosA: number; pontosB: number }
export type CategoryMatchRules = { setsPorPartida: number; pontosPorSet: number; setsFormato?: string; terceiroSetObrigatorio?: boolean; tieBreakUltimoSet?: boolean; pontosUltimoSet?: number }

/**
 * Aceita ou recusa um placar já montado.
 * @param sets lista de sets com número e pontos dos dois lados
 * @param rules quantidade de sets, pontos, formato, tie-break e terceiro set obrigatório
 * @returns `null` se o placar fecha; senão a mensagem de recusa
 * Sem I/O. O set fecha ao atingir o alvo com diferença mínima de 2, sem teto.
 * Fora do modo fixo, a partida pode encerrar sem o terceiro set, ao contrário de
 * `brain/03 - Súmula Digital/Resultado Final.md`.
 */
export function validateCategoryResult(sets: CategorySet[], rules: CategoryMatchRules): string | null {
  const maxSets = Number(rules.setsPorPartida)
  const requiredWins = Math.floor(maxSets / 2) + 1
  const fixed = rules.setsFormato === 'QUANTIDADE_FIXA' || rules.terceiroSetObrigatorio === true
  if (!Number.isInteger(maxSets) || maxSets < 1 || maxSets > 5) return 'Configuração de sets inválida.'
  if (!sets.length || sets.length > maxSets) return 'Quantidade de sets inválida.'
  let winsA = 0, winsB = 0
  const ordered = [...sets].sort((a, b) => a.numero - b.numero)
  for (let index=0; index<ordered.length; index++) {
    const set=ordered[index]
    if (set.numero !== index + 1 || ![set.pontosA, set.pontosB].every(n => Number.isSafeInteger(n) && n >= 0)) return 'Numeração ou pontuação de set inválida.'
    if (!fixed && Math.max(winsA, winsB) >= requiredWins) return 'Há sets após o encerramento da partida.'
    const target = set.numero === maxSets && rules.tieBreakUltimoSet ? Number(rules.pontosUltimoSet) : Number(rules.pontosPorSet)
    const winner = Math.max(set.pontosA, set.pontosB), loser = Math.min(set.pontosA, set.pontosB)
    if (!Number.isInteger(target) || target < 1 || winner < target || winner - loser < 2) return `O set ${set.numero} deve terminar com a pontuação configurada e diferença mínima de 2.`
    if (set.pontosA > set.pontosB) winsA++; else winsB++
  }
  if (fixed ? sets.length !== maxSets : Math.max(winsA, winsB) !== requiredWins) return 'A partida ainda não concluiu os sets exigidos.'
  if (winsA === winsB) return 'A partida precisa de um vencedor.'
  return null
}

/** Aceita o set em andamento no fim da lista. Os sets anteriores precisam já ter fechado. */
export function validateCategoryProgress(sets: CategorySet[], rules: CategoryMatchRules): string | null {
  const maxSets = Number(rules.setsPorPartida)
  const requiredWins = Math.floor(maxSets / 2) + 1
  if (!Number.isInteger(maxSets) || maxSets < 1 || maxSets > 5) return 'Configuração de sets inválida.'
  if (sets.length > maxSets) return 'Quantidade de sets inválida.'
  let winsA = 0
  let winsB = 0
  const ordered = [...sets].sort((a, b) => a.numero - b.numero)
  for (let index = 0; index < ordered.length; index += 1) {
    const set = ordered[index]
    const last = index === ordered.length - 1
    if (set.numero !== index + 1 || ![set.pontosA, set.pontosB].every((n) => Number.isSafeInteger(n) && n >= 0)) {
      return 'Numeração ou pontuação de set inválida.'
    }
    if (Math.max(winsA, winsB) >= requiredWins) return 'Há sets após o encerramento da partida.'
    const target = set.numero === maxSets && rules.tieBreakUltimoSet ? Number(rules.pontosUltimoSet) : Number(rules.pontosPorSet)
    const winner = Math.max(set.pontosA, set.pontosB)
    const loser = Math.min(set.pontosA, set.pontosB)
    const closed = Number.isInteger(target) && target >= 1 && winner >= target && winner - loser >= 2
    if (!last && !closed) return `O set ${set.numero} deve terminar com a pontuação configurada e diferença mínima de 2.`
    if (!closed) continue
    if (set.pontosA > set.pontosB) winsA += 1
    else winsB += 1
  }
  return null
}
