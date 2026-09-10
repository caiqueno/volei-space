// Motor de validação consolidado — agrega os dados reais da Liga (com IO,
// via supabaseAdmin) e roda as validações puras de championship-validation.ts,
// retornando o resultado por seção. Separado das validações puras para que
// scripts/championship-setup.test.ts possa importar só as funções puras sem
// precisar de um cliente Supabase configurado.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import type { SetupSection } from '@/lib/championship-setup-status'
import {
  type ValidationIssue,
  computeTotalClassificadosFormula,
  validateClassificacaoEliminatoriaMatch,
  validateDateRange,
  validateElencoRange,
  validateQrPhotoNameDependency,
} from '@/lib/championship-validation'
import { getDefaultFormularioInscricaoConfig } from '@/lib/championship-setup-defaults'

export interface ChampionshipValidationResult {
  isValid: boolean
  canPublish: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  perSecao: Record<SetupSection, ValidationIssue[]>
}

export async function validateChampionshipSetup(ligaId: number): Promise<ChampionshipValidationResult> {
  const [{ data: liga }, { data: grupos }, { count: aprovadasCount }] = await Promise.all([
    supabase.from('Liga').select('*').eq('id', ligaId).single(),
    supabase.from('GrupoCampeonato').select('classificados').eq('ligaId', ligaId),
    supabase.from('InscricaoCampeonato').select('id', { count: 'exact', head: true }).eq('ligaId', ligaId).eq('status', 'APROVADA'),
  ])

  const perSecao: Record<SetupSection, ValidationIssue[]> = {
    informacoes: [],
    estrutura: [],
    classificacao: [],
    eliminatorias: [],
    calendario: [],
    inscricoes: [],
  }

  if (!liga) {
    return { isValid: false, canPublish: false, errors: [], warnings: [], perSecao }
  }

  // Estrutura: grupos matematicamente compatíveis com a quantidade prevista.
  if (liga.quantidadeEquipesMinima != null && liga.quantidadeEquipesMaxima != null && liga.quantidadeEquipesMinima > liga.quantidadeEquipesMaxima) {
    perSecao.estrutura.push({ section: 'estrutura', code: 'EQUIPES_MIN_MAIOR_QUE_MAX', message: 'A quantidade mínima de equipes não pode ser maior que a máxima.', severity: 'error' })
  }
  if (liga.quantidadeGrupos != null && liga.quantidadeEquipes != null && liga.quantidadeGrupos > liga.quantidadeEquipes) {
    perSecao.estrutura.push({ section: 'estrutura', code: 'GRUPOS_MAIOR_QUE_EQUIPES', message: `Não é possível ter ${liga.quantidadeGrupos} grupos com apenas ${liga.quantidadeEquipes} equipes previstas.`, severity: 'error' })
  }

  // Classificação x Eliminatórias — validação cruzada central da spec.
  // Quando já existem GrupoCampeonato reais (distribuição real já rodou em
  // /painel/estrutura), soma "classificados" por grupo diretamente; senão,
  // usa a fórmula genérica (computeTotalClassificadosFormula, também
  // reaproveitada pelo cálculo automático de fase no wizard).
  const totalClassificados = (grupos ?? []).length > 0
    ? (grupos ?? []).reduce((total: number, grupo: any) => total + Number(grupo.classificados ?? 0), 0) + Number(liga.melhoresClassificadosGerais ?? 0)
    : computeTotalClassificadosFormula(liga)
  const matchError = validateClassificacaoEliminatoriaMatch({
    faseEliminatoria: liga.faseEliminatoria,
    formato: liga.formato,
    totalClassificados,
    quantidadeEquipes: liga.quantidadeEquipes,
    temGrupos: (grupos ?? []).length > 0,
  })
  if (matchError) {
    // Reportado nas DUAS seções (não só eliminatórias): a spec pede que
    // Classificação também possa virar attention-required nesse cenário,
    // já que o mismatch pode ser corrigido a partir de qualquer um dos
    // dois lados (ajustar classificados por grupo OU trocar a fase).
    perSecao.classificacao.push({ section: 'classificacao', code: 'CLASSIFICADOS_INCOMPATIVEIS_COM_FASE', message: matchError, severity: 'error' })
    perSecao.eliminatorias.push({ section: 'eliminatorias', code: 'CLASSIFICADOS_INCOMPATIVEIS_COM_FASE', message: matchError, severity: 'error' })
  }

  // Calendário
  const calendarError = validateDateRange(liga.dataInicio, liga.dataFim)
  if (calendarError) {
    perSecao.calendario.push({ section: 'calendario', code: 'DATAS_INVALIDAS', message: calendarError, severity: 'error' })
  }

  // Inscrições
  const inscricoesDatesError = validateDateRange(liga.inscricoesAberturaEm, liga.inscricoesEncerramentoEm)
  if (inscricoesDatesError) {
    perSecao.inscricoes.push({ section: 'inscricoes', code: 'INSCRICOES_DATAS_INVALIDAS', message: inscricoesDatesError, severity: 'error' })
  }
  const elencoError = validateElencoRange(liga.elencoQuantidadeMinima, liga.elencoQuantidadeMaxima)
  if (elencoError) {
    perSecao.inscricoes.push({ section: 'inscricoes', code: 'ELENCO_MIN_MAIOR_QUE_MAX', message: elencoError, severity: 'error' })
  }
  // Um formularioInscricaoConfig ainda null significa "organizador nunca
  // customizou", não "configuração inválida" — o mesmo fallback para o
  // default (já compatível com QR) usado no PATCH de inscrições é aplicado
  // aqui, para não gerar attention-required artificial em campeonatos que
  // nunca tocaram esta seção (inclui os campeonatos existentes, cujo
  // formularioInscricaoConfig nasceu null na migration).
  const atletaConfigEfetivo = liga.formularioInscricaoConfig?.atleta ?? getDefaultFormularioInscricaoConfig().atleta
  const qrIssues = validateQrPhotoNameDependency(liga.qrCodeEnabled, atletaConfigEfetivo)
  perSecao.inscricoes.push(...qrIssues)

  if (liga.quantidadeEquipes != null && Number(aprovadasCount ?? 0) > liga.quantidadeEquipes) {
    perSecao.inscricoes.push({
      section: 'inscricoes',
      code: 'INSCRICOES_ACIMA_DO_LIMITE',
      message: 'Existem mais equipes aprovadas do que o limite máximo configurado.',
      severity: 'warning',
    })
  }

  const errors = Object.values(perSecao).flat().filter((issue) => issue.severity === 'error')
  const warnings = Object.values(perSecao).flat().filter((issue) => issue.severity === 'warning')

  return {
    isValid: errors.length === 0,
    canPublish: errors.length === 0,
    errors,
    warnings,
    perSecao,
  }
}
