// Só validações PURAS (sem IO) neste arquivo — importado tanto pelas rotas
// de API quanto por scripts/championship-setup.test.ts (ts-node puro, sem
// resolução de path alias de infraestrutura). Nunca importe supabase-admin
// ou qualquer módulo com efeito colateral aqui; o motor com IO fica em
// championship-setup-engine.ts.
import { getRequiredEliminatoryTeams, normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import type { SetupSection } from '@/lib/championship-setup-status'
import type { FieldRequirement } from '@/lib/schemas'

export interface ValidationIssue {
  section: SetupSection
  code: string
  message: string
  severity: 'error' | 'warning'
}

// ---------------------------------------------------------------------------
// Validações puras (sem IO) — cada uma testável isoladamente em
// scripts/championship-setup.test.ts.
// ---------------------------------------------------------------------------

export interface EliminatoryCapacityInput {
  formato?: string | null
  faseEliminatoria?: string | null
  quantidadeEquipes?: number | null
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  melhoresClassificadosGerais?: number | null
  // Quando fornecido (uso real de estrutura/route.ts, já com equipes
  // distribuídas em grupos concretos), o cálculo de classificados usa o
  // tamanho real de cada grupo em vez da fórmula genérica
  // quantidadeGrupos*classificadosPorGrupo — preserva exatamente o
  // comportamento hoje duplicado em validateGroups().
  groupSizes?: number[]
}

// Consolida as 3 cópias hoje duplicadas de validateEliminatoryConfiguration
// (src/app/api/ligas/route.ts, src/app/api/ligas/[slug]/route.ts, e a
// variante inline em estrutura/route.ts::validateGroups). Retorna '' quando
// válido, ou uma mensagem de erro explícita quando a fase eliminatória
// escolhida é matematicamente incompatível com a quantidade de equipes
// classificadas (validação cruzada Classificação x Eliminatórias).
export function validateEliminatoryCapacity(input: EliminatoryCapacityInput): string {
  const formato = input.formato === 'COPA_CURTA' ? 'MATA_MATA' : input.formato
  const faseEliminatoria = formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : normalizeEliminatoryPhase(input.faseEliminatoria || 'SEMIFINAL')
  const required = getRequiredEliminatoryTeams(faseEliminatoria)
  if (required <= 0) return ''

  const quantidadeEquipes = Number(input.quantidadeEquipes ?? 0)
  if (quantidadeEquipes > 0 && quantidadeEquipes < required) {
    return `A fase eliminatória escolhida exige ${required} equipes classificadas. Ajuste a quantidade de equipes ou escolha uma fase menor.`
  }

  const extra = Number(input.melhoresClassificadosGerais ?? 0)

  if (input.groupSizes) {
    const classificadosPorGrupo = Number(input.classificadosPorGrupo ?? 0)
    const automaticClassified = input.groupSizes.reduce((total, size) => total + Math.min(classificadosPorGrupo, size), 0) + extra
    if (automaticClassified > required) {
      return `A fase eliminatória escolhida exige ${required} equipes classificadas, mas os grupos avançariam ${automaticClassified}.`
    }
    if (required > quantidadeEquipes) {
      return `A fase eliminatória escolhida exige ${required} equipes classificadas, mas o campeonato tem apenas ${quantidadeEquipes} equipe(s) aprovada(s).`
    }
    return ''
  }

  const automatic = Number(input.quantidadeGrupos ?? 1) * Number(input.classificadosPorGrupo ?? 0) + extra
  if (automatic > required) {
    return `A fase eliminatória escolhida exige ${required} equipes classificadas, mas a configuração automática avançaria ${automatic}. Reduza os classificados por grupo ou escolha uma fase maior, ou ajuste "melhores classificados gerais".`
  }
  return ''
}

// Validação cruzada central da spec: o TOTAL de equipes classificadas
// (já agregado pelo chamador — grupos reais quando existem, ou a fórmula
// genérica quantidadeGrupos*classificadosPorGrupo + melhoresClassificadosGerais
// quando ainda não há distribuição real) precisa bater EXATAMENTE com o que
// a fase eliminatória escolhida exige. Diferente de validateEliminatoryCapacity
// (que só barra excesso, para não quebrar o comportamento hoje já existente
// nas rotas legadas de Liga/estrutura), esta é a checagem estrita "6 != 8"
// do exemplo da spec — não corrige silenciosamente, não classifica
// terceiros automaticamente.
export interface ClassificacaoEliminatoriaMatchInput {
  faseEliminatoria?: string | null
  formato?: string | null
  totalClassificados: number
  // Num mata-mata puro (sem fase de grupos) quem "classifica" para a chave
  // são as próprias equipes inscritas — não existe corte por grupo.
  quantidadeEquipes?: number | null
  temGrupos?: boolean
}

export function validateClassificacaoEliminatoriaMatch(input: ClassificacaoEliminatoriaMatchInput): string {
  const faseEliminatoria = input.formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : input.faseEliminatoria
  const required = getRequiredEliminatoryTeams(faseEliminatoria)
  if (required <= 0) return ''

  // Mata-mata puro sem grupos configurados: comparar contra a quantidade de
  // equipes, não contra a fórmula de classificados por grupo (que exigiria
  // do organizador inventar "1 grupo com N classificados" numa competição
  // que não tem grupos). Só entra neste ramo quando realmente não há grupos.
  const mataMataPuro = (input.formato === 'MATA_MATA' || input.formato === 'COPA_CURTA') && !input.temGrupos
  if (mataMataPuro) {
    const equipes = Number(input.quantidadeEquipes ?? 0)
    if (equipes > 0 && equipes !== required) {
      return `O mata-mata começa em ${formatRequired(required)}, que exige exatamente ${required} equipes, mas o campeonato está configurado com ${equipes}.`
    }
    return ''
  }

  if (input.totalClassificados !== required) {
    return `A configuração de classificação prevê ${input.totalClassificados} equipe(s) classificada(s), mas a fase eliminatória escolhida exige exatamente ${required}.`
  }
  return ''
}

function formatRequired(required: number): string {
  const labels: Record<number, string> = { 2: 'final', 4: 'semifinal', 8: 'quartas de final', 16: 'oitavas de final', 32: 'dezesseis avos de final' }
  return labels[required] ?? `uma fase de ${required} equipes`
}

// Fórmula de "quantos classificados no total" quando ainda não existem
// GrupoCampeonato reais (distribuição real só roda depois que as inscrições
// fecham) — extraída daqui para ser reaproveitada tanto pelo motor de
// validação com IO (championship-setup-engine.ts) quanto pelo cálculo
// automático da fase eliminatória no wizard (client-side), sem duplicar a
// conta em dois lugares.
export function computeTotalClassificadosFormula(input: {
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  melhoresClassificadosGerais?: number | null
}): number {
  return Number(input.quantidadeGrupos ?? 1) * Number(input.classificadosPorGrupo ?? 0) + Number(input.melhoresClassificadosGerais ?? 0)
}

// Regra obrigatória: se o QR Code de conferência estiver habilitado, nome
// completo e foto do atleta precisam ser 'required' no formulário dinâmico
// de inscrição. Nunca depende do futuro frontend — reforçada aqui e também
// no superRefine do Zod (setupInscricoesSchema).
export function validateQrPhotoNameDependency(
  qrCodeEnabled: boolean | null | undefined,
  atletaConfig: { nomeCompleto?: FieldRequirement; foto?: FieldRequirement } | null | undefined,
): ValidationIssue[] {
  if (!qrCodeEnabled) return []
  const issues: ValidationIssue[] = []
  if (atletaConfig?.nomeCompleto !== 'required') {
    issues.push({
      section: 'inscricoes',
      code: 'QR_REQUIRES_ATLETA_NOME',
      message: 'QR Code de conferência exige que o nome completo do atleta seja obrigatório.',
      severity: 'error',
    })
  }
  if (atletaConfig?.foto !== 'required') {
    issues.push({
      section: 'inscricoes',
      code: 'QR_REQUIRES_ATLETA_FOTO',
      message: 'QR Code de conferência exige que a foto do atleta seja obrigatória.',
      severity: 'error',
    })
  }
  return issues
}

export function validateElencoRange(min?: number | null, max?: number | null): string {
  if (min != null && max != null && min > max) {
    return 'A quantidade mínima de atletas não pode ser maior que a máxima.'
  }
  return ''
}

export function validateDateRange(start?: string | null, end?: string | null): string {
  if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
    return 'A data final não pode ser anterior à data inicial.'
  }
  return ''
}

// O motor de validação consolidado com IO (validateChampionshipSetup, que
// agrega os dados reais da Liga e roda as validações acima) vive em
// championship-setup-engine.ts — mantido fora deste arquivo para que este
// módulo continue seguro de importar em contextos sem Supabase configurado
// (ex.: scripts/championship-setup.test.ts).
