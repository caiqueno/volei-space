/**
 * Plano puro para copiar seções de configuração entre categorias do mesmo
 * campeonato e do mesmo organizador. Não grava no banco.
 * O `/brain` não descreve essa cópia (gap). A diferença mínima 2, quando o campo
 * vem preenchido, segue `brain/03 - Súmula Digital/Fechamento de Set.md`.
 * Formatos com mata-mata e sets configuráveis divergem de
 * `brain/02 - Regulamento e Regras da Liga/Formato da Temporada.md`.
 * Os inteiros de pontos da seção de classificação não aplicam a tabela 4/3/1/0
 * de `brain/02 - Regulamento e Regras da Liga/Sistema de Pontuação.md`.
 */
import { z } from 'zod'

const integer = z.number().int().nonnegative()
const positive = z.number().int().positive()
const requirement = z.enum(['disabled', 'optional', 'required'])
const formSchema = z.object({
  equipe: z.object({ nome: requirement, nomeAbreviado: requirement, logo: requirement, cidade: requirement, instagram: requirement }).partial().strict(),
  lider: z.object({ nomeCompleto: requirement, cpf: requirement, dataNascimento: requirement, whatsapp: requirement, email: requirement, documento: requirement, foto: requirement }).partial().strict(),
  atleta: z.object({ nomeCompleto: requirement, cpf: requirement, rg: requirement, dataNascimento: requirement, foto: requirement, numeroCamisa: requirement, posicao: requirement, altura: requirement, instagram: requirement, documento: requirement }).partial().strict(),
}).partial().strict()

/** Parâmetros que a cópia pode gravar. Identidade e estado operacional ficam de fora. */
export const REPLICATION_SECTION_SCHEMAS = {
  estrutura: z.object({
    quantidadeEquipes: positive.nullable(), quantidadeEquipesMinima: positive.nullable(), quantidadeEquipesMaxima: positive.nullable(),
    formato: z.enum(['PONTOS_CORRIDOS', 'GRUPOS_MATA_MATA', 'MATA_MATA']).nullable(),
    quantidadeGrupos: positive.max(32).nullable(), nomesGrupos: z.string().nullable(), turnoReturno: z.boolean().nullable(),
  }).strict(),
  regras: z.object({
    setsFormato: z.enum(['MELHOR_DE', 'QUANTIDADE_FIXA']).nullable(), setsPorPartida: positive.max(5).nullable(),
    pontosPorSet: positive.max(99).nullable(), tieBreakUltimoSet: z.boolean().nullable(), pontosUltimoSet: positive.max(99).nullable(),
    terceiroSetObrigatorio: z.boolean().nullable(),
  }).strict(),
  classificacao: z.object({
    criteriosClassificacao: z.string().nullable(), classificadosPorGrupo: integer.max(64).nullable(), melhoresClassificadosGerais: integer.max(64).nullable(),
    pontosVencedorMargem1: integer.nullable(), pontosPerdedorMargem1: integer.nullable(),
    pontosVencedorMargem2: integer.nullable(), pontosPerdedorMargem2: integer.nullable(),
    woSetsVencedor: positive.max(5).nullable().optional(), woSetsPerdedor: integer.max(5).nullable().optional(),
    woPontosSetVencedor: integer.max(99).nullable().optional(), woPontosSetPerdedor: integer.max(99).nullable().optional(),
    woPunicaoPontos: integer.max(20).nullable().optional(),
  }).strict(),
  eliminatorias: z.object({
    faseEliminatoria: z.enum(['NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS']).nullable(),
    metodoChaveamento: z.enum(['RANKING_GERAL', 'CRUZAMENTO_GRUPOS', 'SORTEIO', 'MANUAL']).nullable(),
    eliminatoriaIdaVolta: z.boolean().nullable(), disputaTerceiroLugar: z.boolean().nullable(), goldenSet: z.boolean().nullable(),
    setsPorPartidaFinal: positive.max(5).nullable().optional(),
    setsPorPartidaSemifinal: positive.max(5).nullable().optional(),
    setsPorPartidaTerceiroLugar: positive.max(5).nullable().optional(),
  }).strict(),
  calendario: z.object({ dataInicio: z.string().datetime({ offset: true }).nullable(), dataFim: z.string().datetime({ offset: true }).nullable() }).strict(),
  inscricoes: z.object({
    inscricoesAberturaEm: z.string().datetime({ offset: true }).nullable(), inscricoesEncerramentoEm: z.string().datetime({ offset: true }).nullable(),
    inscricaoPermiteEdicaoAposEnvio: z.boolean().nullable(), inscricaoPrazoEdicaoDias: integer.max(365).nullable(),
    elencoQuantidadeMinima: positive.nullable(), elencoQuantidadeMaxima: positive.nullable(),
    // Inscrição sempre vinculada ao elenco: a replicação nunca pode
    // reintroduzir false num destino, mesmo que a origem seja um registro
    // legado com esse valor.
    elencoCadastroDuranteInscricao: z.boolean().nullable().transform((v) => (v === false ? true : v)), prazoAlteracaoElencoDias: integer.max(365).nullable(), formularioInscricaoConfig: formSchema.nullable(),
  }).strict(),
  recursos: z.object({ sumulaScoutsEnabled: z.boolean().nullable(), qrCodeEnabled: z.boolean().nullable() }).strict(),
} as const

export type ReplicationSection = keyof typeof REPLICATION_SECTION_SCHEMAS
export type ReplicationSnapshot = Partial<{ [K in ReplicationSection]: z.infer<typeof REPLICATION_SECTION_SCHEMAS[K]> }>
export type ReplicationMode = 'empty-only' | 'replace-sections'
export interface ReplicationOperations {
  publishedForms: number
  teams: number
  occupiedGroups: number
  matches: number
  startedScoresheets: number
  inProgress: boolean
}
export interface CategoryReplicationState {
  id: string
  ligaId: number
  organizadorId: string
  configVersion: number
  operationVersion: number
  configuration: Readonly<Record<string, unknown>>
  hasSavedConfiguration: boolean
  operations: ReplicationOperations
}
export interface ReplicationIssue { field: string; message: string }
export type ReplicationValidator = (configuration: Readonly<Record<string, unknown>>, target: CategoryReplicationState) => readonly ReplicationIssue[]
export interface ReplicationDiff { section: ReplicationSection; field: string; before: unknown; after: unknown }
export interface ReplicationTargetPreview {
  id: string
  configVersion: number
  operationVersion: number
  blockedReasons: string[]
  differences: ReplicationDiff[]
  /** Único objeto que a gravação pode aplicar; `configuration` serve para validar. */
  patch: Record<string, unknown>
  configuration: Record<string, unknown>
  issues: ReplicationIssue[]
  status: 'blocked' | 'unchanged' | 'copied-review' | 'attention-required'
}
export interface ReplicationPreview {
  sourceId: string
  ligaId: number
  organizadorId: string
  sourceConfigVersion: number
  sourceOperationVersion: number
  sections: ReplicationSection[]
  mode: ReplicationMode
  snapshot: ReplicationSnapshot
  targets: ReplicationTargetPreview[]
}

function clone<T>(value: T): T { return structuredClone(value) }
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort()
  return ak.length === bk.length && ak.every((key, index) => key === bk[index] && same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/**
 * Recorta a configuração nas seções pedidas.
 * @param configuration mapa completo da origem
 * @param sections seções distintas e conhecidas
 * @returns snapshot; campo ausente na origem vira `null`
 * `elencoCadastroDuranteInscricao: false` torna-se `true` no parse do schema.
 * Lança se a lista de seções for vazia, repetida ou desconhecida.
 */
export function createReplicationSnapshot(configuration: Readonly<Record<string, unknown>>, sections: readonly ReplicationSection[]): ReplicationSnapshot {
  if (sections.length === 0 || new Set(sections).size !== sections.length) throw new Error('Selecione seções distintas para copiar.')
  const snapshot: Record<string, unknown> = {}
  for (const section of sections) {
    if (!Object.prototype.hasOwnProperty.call(REPLICATION_SECTION_SCHEMAS, section)) throw new Error('Seção inválida.')
    const schema = REPLICATION_SECTION_SCHEMAS[section]
    const fields: Record<string, unknown> = {}
    // Missing parameters clear the selected section rather than retaining stale target values.
    for (const field of Object.keys(schema.shape)) {
      const value = configuration[field] ?? null
      if ((field === 'setsPorPartidaFinal' || field === 'setsPorPartidaSemifinal' || field === 'setsPorPartidaTerceiroLugar') && value == null) continue
      fields[field] = value
    }
    snapshot[section] = schema.parse(fields)
  }
  return clone(snapshot) as ReplicationSnapshot
}

/**
 * Traduz contagens operacionais em frases de bloqueio.
 * @param operations formulários, equipes, grupos, partidas, súmulas e flag de andamento
 * @returns motivos para não copiar; lista vazia se nada bloqueia
 * Inclui "Súmula já iniciada" e "Operação esportiva em andamento".
 * `readReplicationState` em `category-replication-server.ts` grava essas duas
 * informações como 0 e `false`, então por esse leitor a trava não dispara.
 */
export function getReplicationBlockReasons(operations: ReplicationOperations): string[] {
  const labels = { publishedForms: 'Formulário já disponibilizado.', teams: 'Equipe já cadastrada.', occupiedGroups: 'Grupo já ocupado.', matches: 'Partida já gerada.', startedScoresheets: 'Súmula já iniciada.' }
  const reasons: string[] = []
  for (const [key, label] of Object.entries(labels)) {
    const count = operations[key as keyof typeof labels]
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Contagem operacional inválida.')
    if (count > 0) reasons.push(label)
  }
  if (typeof operations.inProgress !== 'boolean') throw new Error('Estado operacional inválido.')
  if (operations.inProgress) reasons.push('Operação esportiva em andamento.')
  return reasons
}

/**
 * Invariantes locais do plano copiado. Não grava.
 * @param config configuração já com o patch aplicado
 * @returns lista de problemas; vazia se o plano passa nestas checagens
 * Exige diferença 2 quando `diferencaMinimaSet` vem preenchido
 * (`brain/03 - Súmula Digital/Fechamento de Set.md`). Terceiro set obrigatório
 * só com 3 sets. Datas de calendário e de inscrição não podem terminar antes de começar.
 * Pontos corridos não levam chave; a quantidade de classificados tem de bater com a fase.
 * Com QR Code, exige nome e foto do atleta como obrigatórios — recorte de
 * `brain/06 - Equipes e Atletas/QR Code dos Atletas.md`, que também pede número, equipe, categoria e status.
 */
export function validateReplicatedConfiguration(config: Readonly<Record<string, unknown>>): ReplicationIssue[] {
  const issues: ReplicationIssue[] = []
  const issue = (field: string, message: string) => issues.push({ field, message })
  if (!config.formato || config.quantidadeEquipes == null) issue('estrutura', 'Informe formato e quantidade de equipes.')
  for (const [min, max] of [['quantidadeEquipesMinima', 'quantidadeEquipesMaxima'], ['elencoQuantidadeMinima', 'elencoQuantidadeMaxima']] as const) {
    if (typeof config[min] === 'number' && typeof config[max] === 'number' && config[min] > config[max]) issue(min, 'O mínimo não pode superar o máximo.')
  }
  const count = config.quantidadeEquipes
  if (typeof count === 'number') {
    if (typeof config.quantidadeEquipesMinima === 'number' && count < config.quantidadeEquipesMinima) issue('quantidadeEquipes', 'Quantidade abaixo do mínimo.')
    if (typeof config.quantidadeEquipesMaxima === 'number' && count > config.quantidadeEquipesMaxima) issue('quantidadeEquipes', 'Quantidade acima do máximo.')
    if (typeof config.quantidadeGrupos === 'number' && config.quantidadeGrupos > count) issue('quantidadeGrupos', 'Há mais grupos que equipes.')
  }
  if (config.diferencaMinimaSet != null && config.diferencaMinimaSet !== 2) issue('diferencaMinimaSet', 'A diferença mínima deve ser 2.')
  if (config.terceiroSetObrigatorio === true && config.setsPorPartida !== 3) issue('terceiroSetObrigatorio', 'O terceiro set obrigatório exige partida de três sets.')
  for (const [start, end] of [['dataInicio', 'dataFim'], ['inscricoesAberturaEm', 'inscricoesEncerramentoEm']] as const) {
    if (typeof config[start] === 'string' && typeof config[end] === 'string' && Date.parse(config[start] as string) > Date.parse(config[end] as string)) issue(end, 'O encerramento não pode anteceder o início.')
  }
  const slots: Record<string, number> = { NENHUMA: 0, FINAL: 2, SEMIFINAL: 4, QUARTAS: 8, OITAVAS: 16, DEZESSEIS_AVOS: 32 }
  const required = slots[String(config.faseEliminatoria)]
  if (config.formato === 'PONTOS_CORRIDOS' && required > 0) issue('faseEliminatoria', 'Pontos corridos não possui eliminatórias.')
  if (required > 0) {
    const available = config.formato === 'MATA_MATA' ? count : typeof config.quantidadeGrupos === 'number' && typeof config.classificadosPorGrupo === 'number'
      ? config.quantidadeGrupos * config.classificadosPorGrupo + Number(config.melhoresClassificadosGerais ?? 0) : null
    if (available !== required) issue('faseEliminatoria', 'A quantidade de classificados deve corresponder à chave eliminatória.')
  }
  if (config.qrCodeEnabled === true) {
    const parsed = formSchema.safeParse(config.formularioInscricaoConfig)
    if (!parsed.success || parsed.data.atleta?.nomeCompleto !== 'required' || parsed.data.atleta?.foto !== 'required') issue('formularioInscricaoConfig', 'QR Code exige nome completo e foto obrigatórios para atletas.')
  }
  return issues
}

function validateState(state: CategoryReplicationState) {
  if (!z.string().uuid().safeParse(state.id).success || !Number.isSafeInteger(state.ligaId) || state.ligaId <= 0 || !state.organizadorId ||
    ![state.configVersion, state.operationVersion].every(n => Number.isSafeInteger(n) && n >= 0) || typeof state.hasSavedConfiguration !== 'boolean') throw new Error('Identidade ou versão de categoria inválida.')
}

/**
 * Monta a prévia da cópia em memória.
 * @param source categoria de origem, já com configuração salva
 * @param targets destinos distintos, do mesmo `ligaId` e do mesmo `organizadorId`
 * @param sections seções a copiar
 * @param mode `empty-only` bloqueia destino que já tem configuração; `replace-sections` substitui as seções
 * @param validate validador extra, opcional
 * @returns prévia com `patch` limitado às seções pedidas
 * Sem I/O. Quem chama autentica e lê o estado no banco.
 */
export function previewCategoryReplication(source: CategoryReplicationState, targets: readonly CategoryReplicationState[], sections: readonly ReplicationSection[], mode: ReplicationMode, validate?: ReplicationValidator): ReplicationPreview {
  validateState(source)
  if (!source.hasSavedConfiguration) throw new Error('Salve a configuração de origem antes de copiar.')
  if (mode !== 'empty-only' && mode !== 'replace-sections') throw new Error('Modo de cópia inválido.')
  if (!targets.length || new Set(targets.map(target => target.id)).size !== targets.length) throw new Error('Selecione destinos distintos.')
  const snapshot = createReplicationSnapshot(source.configuration, sections)
  const previews = targets.map(target => {
    validateState(target)
    if (target.id === source.id || target.ligaId !== source.ligaId || target.organizadorId !== source.organizadorId) throw new Error('Origem e destinos devem ser categorias distintas do mesmo campeonato e organizador.')
    const blockedReasons = mode === 'empty-only' ? getReplicationBlockReasons(target.operations) : []
    if (mode === 'empty-only' && target.hasSavedConfiguration) blockedReasons.push('A categoria já possui configuração salva.')
    const configuration = clone(target.configuration) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    const differences: ReplicationDiff[] = []
    for (const section of sections) for (const [field, after] of Object.entries(snapshot[section]!)) {
      const before = configuration[field] ?? null
      if (!same(before, after)) differences.push({ section, field, before: clone(before), after: clone(after) })
      configuration[field] = clone(after)
      patch[field] = clone(after)
    }
    const issues = [...validateReplicatedConfiguration(configuration), ...(validate?.(clone(configuration), target) ?? [])]
    const status: ReplicationTargetPreview['status'] = blockedReasons.length ? 'blocked' : !differences.length ? 'unchanged' : issues.length ? 'attention-required' : 'copied-review'
    return { id: target.id, configVersion: target.configVersion, operationVersion: target.operationVersion, blockedReasons, differences, patch, configuration, issues, status }
  })
  return {
    sourceId: source.id, ligaId: source.ligaId, organizadorId: source.organizadorId,
    sourceConfigVersion: source.configVersion, sourceOperationVersion: source.operationVersion,
    sections: [...sections], mode, snapshot, targets: previews,
  }
}

/**
 * Recusa plano cuja origem, destino, versão ou bloqueio mudou desde a prévia.
 * Deve ser chamada dentro da transação, com o estado relido. Devolve um plano novo;
 * não se grava a configuração que o cliente mandou.
 * Autenticação, trava, escrita e auditoria ficam com quem chama.
 * A rota `replicar/route.ts` não chama esta função.
 */
export function assertReplicationPreviewCurrent(preview: ReplicationPreview, source: CategoryReplicationState, targets: readonly CategoryReplicationState[], validate?: ReplicationValidator): ReplicationPreview {
  if (preview.sourceId !== source.id || preview.ligaId !== source.ligaId || preview.organizadorId !== source.organizadorId ||
    preview.sourceConfigVersion !== source.configVersion || preview.sourceOperationVersion !== source.operationVersion) throw new Error('Conflito: a origem mudou. Refaça a comparação.')
  if (targets.length !== preview.targets.length || preview.targets.some(expected => !targets.some(actual => actual.id === expected.id && actual.configVersion === expected.configVersion && actual.operationVersion === expected.operationVersion))) throw new Error('Conflito: um destino mudou. Refaça a comparação.')
  const current = previewCategoryReplication(source, targets, preview.sections, preview.mode, validate)
  if (!same(preview.snapshot, current.snapshot) || current.targets.some(target => target.blockedReasons.length > 0)) throw new Error('Conflito: configuração ou operação mudou. Refaça a comparação.')
  return current
}
