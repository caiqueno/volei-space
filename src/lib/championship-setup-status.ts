// Domínio da Central de Parametrização — status por sessão e grafo de
// dependências. Funções puras (sem IO), para serem testáveis isoladamente.

export type ChampionshipSetupStatus = 'not-started' | 'in-progress' | 'completed' | 'attention-required' | 'blocked'

export type SetupSection = 'informacoes' | 'estrutura' | 'classificacao' | 'eliminatorias' | 'calendario' | 'inscricoes'

export type SetupCardKey = SetupSection | 'previa'

// Ordem fixa das 7 sessões — nunca reordenar por status. Também funciona
// como ordem topológica válida do grafo de dependências abaixo (cada seção
// aparece depois de todas as suas dependências).
export const SECTION_ORDER: SetupSection[] = [
  'informacoes',
  'estrutura',
  'classificacao',
  'eliminatorias',
  'calendario',
  'inscricoes',
]

export const CARD_ORDER: SetupCardKey[] = [...SECTION_ORDER, 'previa']

// Grafo de dependências: a spec pede uma cadeia estrita entre Informações→
// Estrutura→Classificação→Eliminatórias, mas diz explicitamente que
// "Calendário e Inscrições podem ter maior independência" — por isso essas
// duas não dependem de Classificação/Eliminatórias estarem prontas.
export const SECTION_DEPENDENCIES: Record<SetupSection, SetupSection[]> = {
  informacoes: [],
  estrutura: ['informacoes'],
  classificacao: ['estrutura'],
  eliminatorias: ['estrutura', 'classificacao'],
  calendario: ['informacoes'],
  inscricoes: ['estrutura'],
}

// Status armazenado em LigaSetupSecao — reflete só a intenção do
// organizador. 'attention-required' e 'blocked' nunca são armazenados, são
// sempre sobrepostos em tempo de leitura (ver computeEffectiveSectionStatus).
export type StoredSectionStatus = 'not-started' | 'in-progress' | 'completed'

export function computeEffectiveSectionStatus(params: {
  section: SetupSection
  storedStatus: StoredSectionStatus
  effectiveStatusBySection: Partial<Record<SetupSection, ChampionshipSetupStatus>>
  hasValidationErrors: boolean
}): ChampionshipSetupStatus {
  const { section, storedStatus, effectiveStatusBySection, hasValidationErrors } = params
  const dependencies = SECTION_DEPENDENCIES[section]
  const blocked = dependencies.some((dep) => effectiveStatusBySection[dep] !== 'completed')
  if (blocked) return 'blocked'
  if ((storedStatus === 'in-progress' || storedStatus === 'completed') && hasValidationErrors) return 'attention-required'
  return storedStatus
}

// Calcula o status efetivo de todas as 6 sessões de uma vez, na ordem
// correta (SECTION_ORDER já é uma ordem topológica válida do grafo acima).
export function computeAllEffectiveStatuses(
  storedBySection: Record<SetupSection, StoredSectionStatus>,
  hasErrorsBySection: Record<SetupSection, boolean>,
): Record<SetupSection, ChampionshipSetupStatus> {
  const effective = {} as Record<SetupSection, ChampionshipSetupStatus>
  for (const section of SECTION_ORDER) {
    effective[section] = computeEffectiveSectionStatus({
      section,
      storedStatus: storedBySection[section] ?? 'not-started',
      effectiveStatusBySection: effective,
      hasValidationErrors: Boolean(hasErrorsBySection[section]),
    })
  }
  return effective
}

export function computeSetupProgress(effective: Record<SetupSection, ChampionshipSetupStatus>) {
  const completedSections = SECTION_ORDER.filter((section) => effective[section] === 'completed').length
  const totalSections = SECTION_ORDER.length
  const percent = totalSections === 0 ? 0 : Math.round((completedSections / totalSections) * 100)
  return { completedSections, totalSections, percent }
}

// Checagem de "dados próprios da seção presentes" — usada para decidir se
// um PATCH deixa a seção em 'in-progress' ou 'completed' (nunca escreve
// 'not-started': a ausência de linha em LigaSetupSecao já significa isso).
// Recebe o registro de Liga já mesclado (existente + patch aplicado).
//
// Nota: várias colunas têm DEFAULT não-nulo no banco (criteriosClassificacao,
// faseEliminatoria etc.), então essas seções tendem a ficar 'completed' já
// no primeiro PATCH — isso é intencional: representa exatamente os casos em
// que a spec já prevê conclusão automática (ex.: eliminatórias
// faseEliminatoria='NENHUMA' = "não aplicável", já é uma conclusão válida).
export function isSectionOwnDataComplete(section: SetupSection, liga: Record<string, unknown>): boolean {
  switch (section) {
    case 'informacoes':
      return Boolean(liga.nome)
    case 'estrutura':
      return liga.quantidadeEquipes != null && Boolean(liga.formato)
    case 'classificacao':
      return Boolean(liga.criteriosClassificacao)
    case 'eliminatorias':
      return Boolean(liga.faseEliminatoria)
    case 'calendario':
      return liga.dataInicio != null && liga.dataFim != null
    case 'inscricoes':
      return liga.formularioInscricaoConfig != null
    default:
      return false
  }
}

// Campos-âncora de cada seção, com rótulo legível — usados para explicar ao
// organizador o que falta quando ele tenta concluir uma seção incompleta.
const SECTION_REQUIRED_FIELDS: Record<SetupSection, Array<{ key: string; label: string }>> = {
  informacoes: [{ key: 'nome', label: 'Nome do campeonato' }],
  estrutura: [
    { key: 'quantidadeEquipes', label: 'Quantidade de equipes' },
    { key: 'formato', label: 'Formato da competição' },
  ],
  classificacao: [{ key: 'criteriosClassificacao', label: 'Critérios de classificação' }],
  eliminatorias: [{ key: 'faseEliminatoria', label: 'Fase eliminatória' }],
  calendario: [
    { key: 'dataInicio', label: 'Data de início' },
    { key: 'dataFim', label: 'Data de término' },
  ],
  inscricoes: [{ key: 'formularioInscricaoConfig', label: 'Formulário de inscrição' }],
}

export function getMissingSectionFields(section: SetupSection, liga: Record<string, unknown>): string[] {
  return (SECTION_REQUIRED_FIELDS[section] ?? [])
    .filter((field) => liga[field.key] == null || liga[field.key] === '')
    .map((field) => field.label)
}

// Intenção declarada pelo cliente ao salvar uma seção:
// - 'draft'    = autosave do wizard (salvar sem concluir)
// - 'complete' = ação explícita "Salvar e concluir"
export type SetupIntent = 'draft' | 'complete'

// Decide o status a ARMAZENAR em LigaSetupSecao. Função pura (testável sem
// IO). 'attention-required'/'blocked' nunca são armazenados — continuam
// sendo sobrepostos na leitura por computeEffectiveSectionStatus.
//
// Sem isso, o autosave marcaria a seção como 'completed' já no primeiro
// keystroke (vários campos-âncora têm DEFAULT no banco), impedindo o estado
// "Em andamento" que o wizard precisa quando o organizador sai no meio.
export function resolveStoredSectionStatus(params: {
  section: SetupSection
  intent: SetupIntent
  currentStored: StoredSectionStatus
  ligaAfterPatch: Record<string, unknown>
}): StoredSectionStatus {
  const dataComplete = isSectionOwnDataComplete(params.section, params.ligaAfterPatch)

  if (params.intent === 'complete') {
    // A rota rejeita com 422 antes de chegar aqui quando faltam dados; este
    // ramo é defensivo para nunca gravar 'completed' sem os campos-âncora.
    return dataComplete ? 'completed' : 'in-progress'
  }

  // Autosave: uma seção já concluída continua concluída enquanto os dados
  // seguirem completos; caso contrário volta para "em andamento".
  if (params.currentStored === 'completed' && dataComplete) return 'completed'
  return 'in-progress'
}

export const SECTION_TITLES: Record<SetupSection, string> = {
  informacoes: 'Informações do campeonato',
  estrutura: 'Estrutura da competição',
  classificacao: 'Classificação',
  eliminatorias: 'Eliminatórias',
  calendario: 'Calendário e local',
  inscricoes: 'Inscrições',
}

export const CARD_TITLES: Record<SetupCardKey, string> = {
  ...SECTION_TITLES,
  previa: 'Prévia',
}
