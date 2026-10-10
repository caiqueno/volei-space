/**
 * Validação pura do placar de sets segundo a configuração da categoria.
 * Os exemplos de `brain/03 - Súmula Digital/Fechamento de Set.md` passam com alvo 21.
 * O formato único de 3 sets de 21 de `brain/02 - Regulamento e Regras da Liga/Formato da Temporada.md`
 * não está fixado nesta função.
 */
import { quantidadeDeLiberos } from '@/lib/libero-sumula'
import { inteiroDeSets, setsDaFase, type SetsPorFase } from '@/lib/sets-por-fase'

export type CategorySet = { numero: number; pontosA: number; pontosB: number }
export type CategoryMatchRules = SetsPorFase & {
  setsPorPartida: number
  pontosPorSet: number
  setsFormato?: string
  terceiroSetObrigatorio?: boolean
  tieBreakUltimoSet?: boolean
  pontosUltimoSet?: number
  limiteSubstituicoesPorSet?: number | null
  alertaRodizioIlegal?: boolean | null
  limiteTemposPorSet?: number | null
  separarTempos?: boolean | null
  tempoMedico?: boolean | null
  substituicaoPorLesao?: boolean | null
  exigirLiberoInicial?: boolean | null
  quantidadeLiberos?: number | null
}

export function regrasDaConfiguracao(source?: Partial<CategoryMatchRules> | null): CategoryMatchRules {
  return {
    setsPorPartida: Number(source?.setsPorPartida) > 0 ? Number(source?.setsPorPartida) : 3,
    pontosPorSet: Number(source?.pontosPorSet) > 0 ? Number(source?.pontosPorSet) : 21,
    tieBreakUltimoSet: source?.tieBreakUltimoSet === true,
    pontosUltimoSet: Number(source?.pontosUltimoSet) > 0 ? Number(source?.pontosUltimoSet) : 15,
    setsFormato: typeof source?.setsFormato === 'string' ? source.setsFormato : undefined,
    terceiroSetObrigatorio: source?.terceiroSetObrigatorio === true,
    setsPorPartidaFinal: inteiroDeSets(source?.setsPorPartidaFinal),
    setsPorPartidaSemifinal: inteiroDeSets(source?.setsPorPartidaSemifinal),
    setsPorPartidaQuartas: inteiroDeSets(source?.setsPorPartidaQuartas),
    setsPorPartidaOitavas: inteiroDeSets(source?.setsPorPartidaOitavas),
    setsPorPartidaTerceiroLugar: inteiroDeSets(source?.setsPorPartidaTerceiroLugar),
  }
}

/** Aplica a quantidade da fase. O tie-break continua no último set dessa quantidade. */
export function regrasParaFase(source: Partial<CategoryMatchRules> | null | undefined, fase?: string | null): CategoryMatchRules {
  const regras = regrasDaConfiguracao(source)
  const setsPorPartida = setsDaFase(regras, fase)
  return {
    ...regras,
    setsPorPartida,
    terceiroSetObrigatorio: regras.terceiroSetObrigatorio === true && setsPorPartida === 3,
  }
}

/**
 * A categoria da partida é a fonte. Sem categoria, valem as colunas que existem
 * na Liga. `terceiroSetObrigatorio` não é coluna da Liga: o fallback fica desligado.
 * O tie-break da Liga nasce desligado; o da categoria nasce ligado. Não misturar os dois.
 */
export function montarFonteDeRegras(input: {
  liga?: Partial<CategoryMatchRules> | null
  categoria?: Partial<CategoryMatchRules> | null
}): Partial<CategoryMatchRules> {
  if (input.categoria) {
    const categoria = input.categoria
    return {
      setsPorPartida: categoria.setsPorPartida,
      pontosPorSet: categoria.pontosPorSet,
      tieBreakUltimoSet: categoria.tieBreakUltimoSet,
      pontosUltimoSet: categoria.pontosUltimoSet,
      setsFormato: categoria.setsFormato,
      terceiroSetObrigatorio: categoria.terceiroSetObrigatorio,
      setsPorPartidaFinal: categoria.setsPorPartidaFinal ?? null,
      setsPorPartidaSemifinal: categoria.setsPorPartidaSemifinal ?? null,
      setsPorPartidaQuartas: categoria.setsPorPartidaQuartas ?? null,
      setsPorPartidaOitavas: categoria.setsPorPartidaOitavas ?? null,
      setsPorPartidaTerceiroLugar: categoria.setsPorPartidaTerceiroLugar ?? null,
      limiteSubstituicoesPorSet: categoria.limiteSubstituicoesPorSet ?? null,
      alertaRodizioIlegal: categoria.alertaRodizioIlegal === true,
      limiteTemposPorSet: categoria.limiteTemposPorSet ?? null,
      separarTempos: categoria.separarTempos === true,
      tempoMedico: categoria.tempoMedico === true,
      substituicaoPorLesao: categoria.substituicaoPorLesao === true,
      exigirLiberoInicial: categoria.exigirLiberoInicial,
      quantidadeLiberos: quantidadeDeLiberos(categoria.quantidadeLiberos),
    }
  }
  const liga = input.liga ?? {}
  return {
    setsPorPartida: liga.setsPorPartida,
    pontosPorSet: liga.pontosPorSet,
    tieBreakUltimoSet: liga.tieBreakUltimoSet,
    pontosUltimoSet: liga.pontosUltimoSet,
    setsFormato: liga.setsFormato,
    terceiroSetObrigatorio: false,
    setsPorPartidaFinal: liga.setsPorPartidaFinal ?? null,
    setsPorPartidaSemifinal: liga.setsPorPartidaSemifinal ?? null,
    setsPorPartidaQuartas: liga.setsPorPartidaQuartas ?? null,
    setsPorPartidaOitavas: liga.setsPorPartidaOitavas ?? null,
    setsPorPartidaTerceiroLugar: liga.setsPorPartidaTerceiroLugar ?? null,
    limiteSubstituicoesPorSet: liga.limiteSubstituicoesPorSet ?? null,
    alertaRodizioIlegal: liga.alertaRodizioIlegal === true,
    limiteTemposPorSet: liga.limiteTemposPorSet ?? null,
    separarTempos: liga.separarTempos === true,
    tempoMedico: liga.tempoMedico === true,
    substituicaoPorLesao: liga.substituicaoPorLesao === true,
    exigirLiberoInicial: liga.exigirLiberoInicial,
    quantidadeLiberos: quantidadeDeLiberos(liga.quantidadeLiberos),
  }
}

export function partidaExigeTodosOsSets(rules: { setsFormato?: string; terceiroSetObrigatorio?: boolean }) {
  return rules.setsFormato === 'QUANTIDADE_FIXA' || rules.terceiroSetObrigatorio === true
}

export type RegrasVisiveis = {
  pointsPerSet: number
  setsPerMatch: number
  setsToWin: number
  lastSetPoints: number
  exigeTodosOsSets: boolean
}

/** Mesma leitura de `regrasParaFase`, no formato da tela de lançamento. */
export function regrasVisiveis(source: Partial<CategoryMatchRules> | null | undefined, fase?: string | null): RegrasVisiveis {
  const regras = regrasParaFase(source, fase)
  const exigeTodosOsSets = partidaExigeTodosOsSets(regras)
  return {
    pointsPerSet: regras.pontosPorSet,
    setsPerMatch: regras.setsPorPartida,
    setsToWin: exigeTodosOsSets ? regras.setsPorPartida : Math.floor(regras.setsPorPartida / 2) + 1,
    lastSetPoints: regras.tieBreakUltimoSet ? Number(regras.pontosUltimoSet) : regras.pontosPorSet,
    exigeTodosOsSets,
  }
}

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
  const fixed = partidaExigeTodosOsSets(rules)
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
  const fixed = partidaExigeTodosOsSets(rules)
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
    if (!fixed && Math.max(winsA, winsB) >= requiredWins) return 'Há sets após o encerramento da partida.'
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
