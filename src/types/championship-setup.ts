export type {
  ChampionshipSetupStatus,
  SetupSection,
  SetupCardKey,
} from '@/lib/championship-setup-status'

import type { ChampionshipSetupStatus, SetupCardKey, SetupSection } from '@/lib/championship-setup-status'

export interface ChampionshipSetupCardDTO {
  key: SetupCardKey
  title: string
  status: ChampionshipSetupStatus
  summary?: string
  href: string
}

export interface ChampionshipSetupProgressDTO {
  completedSections: number
  totalSections: number
  percent: number
}

export interface ChampionshipSetupResourcesDTO {
  sumulaScoutsEnabled: boolean
  qrCodeEnabled: boolean
}

export interface ChampionshipSetupOverviewDTO {
  ligaId: number
  nome: string
  ligaEmAndamento: boolean
  recursos: ChampionshipSetupResourcesDTO
  progress: ChampionshipSetupProgressDTO
  cards: ChampionshipSetupCardDTO[]
}

export type FieldRequirement = 'disabled' | 'optional' | 'required'

// Os 3 grupos são opcionais no topo (formularioInscricaoConfigSchema é
// `.partial()` na raiz) — o wizard e o servidor enviam/mesclam um grupo por
// vez (ver mergeFormularioConfig na rota de inscrições).
export interface FormularioInscricaoConfig {
  equipe?: { nome?: FieldRequirement; nomeAbreviado?: FieldRequirement; logo?: FieldRequirement; cidade?: FieldRequirement; instagram?: FieldRequirement }
  lider?: { nomeCompleto?: FieldRequirement; cpf?: FieldRequirement; dataNascimento?: FieldRequirement; whatsapp?: FieldRequirement; email?: FieldRequirement; documento?: FieldRequirement; foto?: FieldRequirement }
  atleta?: { nomeCompleto?: FieldRequirement; cpf?: FieldRequirement; rg?: FieldRequirement; dataNascimento?: FieldRequirement; foto?: FieldRequirement; numeroCamisa?: FieldRequirement; posicao?: FieldRequirement; altura?: FieldRequirement; instagram?: FieldRequirement; documento?: FieldRequirement }
}

export interface ValidationIssueDTO {
  section: SetupSection
  code: string
  message: string
  severity: 'error' | 'warning'
}

// Shape comum de todo response de seção: os campos próprios + os dois
// metadados que finalizeSectionPatch sempre acrescenta.
export interface SectionPatchMeta {
  setupStatus: ChampionshipSetupStatus
  issues: ValidationIssueDTO[]
}

export interface InformacoesSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  nome: string
  nomeCurto: string | null
  subtitulo: string | null
  descricao: string | null
  logoUrl: string | null
  capaUrl: string | null
  corTematica: string
  status: 'EM_BREVE' | 'ATIVA' | 'ENCERRADA' | 'FINALIZADO'
  regulamento: string | null
  premiacao: string | null
}

export interface EstruturaSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  status: string
  quantidadeEquipes: number | null
  quantidadeEquipesMinima: number | null
  quantidadeEquipesMaxima: number | null
  formato: string | null
  quantidadeGrupos: number | null
  turnoReturno: boolean
  setsFormato: 'MELHOR_DE' | 'QUANTIDADE_FIXA'
  setsPorPartida: number | null
  /** Null ou ausente mantém 8 substituições por set. */
  limiteSubstituicoesPorSet?: number | null
  /** Só true mostra o aviso. Ausente ou false não altera a súmula. */
  alertaRodizioIlegal?: boolean
  /** Null ou ausente mantém 2 tempos por set. */
  limiteTemposPorSet?: number | null
  /** Só true mostra o tempo de equipe. Ausente ou false mantém um único tempo. */
  separarTempos?: boolean
  /** Só true mostra o tempo médico. Ausente ou false não altera os tempos. */
  tempoMedico?: boolean
  /** Só true permite substituição por lesão fora do limite. Ausente ou false mantém o par e o teto. */
  substituicaoPorLesao?: boolean
  pontosPorSet: number | null
  diferencaMinimaSet: number
  tieBreakUltimoSet: boolean
  pontosUltimoSet: number | null
  sumulaScoutsEnabled: boolean
}

export interface ClassificacaoSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  status: string
  formato?: string | null
  criteriosClassificacao: string | null
  pontuacaoResultado: Array<{ setsVencedor: number; setsPerdedor: number; pontosVencedor: number; pontosPerdedor: number }> | null
  classificadosPorGrupo: number | null
  melhoresClassificadosGerais: number
  /** Só leitura — pertence à Estrutura, usada para pré-preencher o exemplo de pontuação certo. */
  setsPorPartida: number | null
}

export interface EliminatoriasSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  status: string
  faseEliminatoria: string
  metodoChaveamento: 'RANKING_GERAL' | 'CRUZAMENTO_GRUPOS' | 'SORTEIO' | 'MANUAL'
  eliminatoriaIdaVolta: boolean
  disputaTerceiroLugar: boolean
  goldenSet: boolean
  /** Null herda `setsPorPartida` do campeonato. A súmula usa o valor da fase no último set, inclusive o tie-break. */
  setsPorPartida?: number | null
  setsPorPartidaFinal: number | null
  setsPorPartidaSemifinal: number | null
  setsPorPartidaQuartas?: number | null
  setsPorPartidaOitavas?: number | null
  setsPorPartidaTerceiroLugar: number | null
  /** Só leitura — pertencem a Estrutura/Classificação, usados para calcular a fase inicial automaticamente. */
  formato: string | null
  quantidadeEquipes: number | null
  quantidadeGrupos: number | null
  classificadosPorGrupo: number | null
  melhoresClassificadosGerais: number | null
}

export interface LigaLocalDTO {
  id: number
  nome: string
  endereco: string | null
  quadra: string | null
  ordem: number
}

export interface CalendarioSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  status: string
  dataInicio: string | null
  dataFim: string | null
  locais: LigaLocalDTO[]
}

export interface InscricoesSectionDTO extends SectionPatchMeta {
  id: number
  organizadorId: string
  inscricoesAbertas: boolean
  inscricoesAberturaEm: string | null
  inscricoesEncerramentoEm: string | null
  inscricaoAprovacaoAutomatica: boolean
  inscricaoPermiteEdicaoAposEnvio: boolean
  inscricaoPrazoEdicaoDias: number | null
  elencoQuantidadeMinima: number | null
  elencoQuantidadeMaxima: number | null
  elencoCadastroDuranteInscricao: boolean
  elencoCadastroAposAprovacao: boolean
  qrCodeEnabled: boolean
  formularioInscricaoConfig: FormularioInscricaoConfig | null
  prazoAlteracaoElencoDias: number
  genero?: 'MASCULINO' | 'FEMININO' | 'MISTO' | null
  idadeMinima?: number | null
  idadeMaxima?: number | null
}

export interface PricingLineItemDTO {
  key: 'ativacao' | 'gestao' | 'sumulaScouts' | 'qrCode'
  label: string
  unitCents?: number
  totalCents: number
}

export interface PricingDTO {
  matchCount: number
  matchUnitCents: number
  items: PricingLineItemDTO[]
  subtotalCents: number
  discountPercent: number
  discountCents: number
  activationCents: number
  totalCents: number
}

export interface MatchEstimateDTO {
  disponivel: boolean
  total: number
  faseDeGrupos: number
  eliminatorias: number
}

export interface ChampionshipPreviaDTO {
  championship: Pick<InformacoesSectionDTO, 'id' | 'nome' | 'nomeCurto' | 'subtitulo' | 'descricao' | 'logoUrl' | 'capaUrl' | 'status'>
  structure: Omit<EstruturaSectionDTO, 'id' | 'organizadorId' | 'status' | 'setupStatus' | 'issues'> & {
    grupos: Array<{ id: number; nome: string; ordem: number; classificados: number }>
  }
  classification: Omit<ClassificacaoSectionDTO, 'id' | 'organizadorId' | 'status' | 'setupStatus' | 'issues'>
  knockout: Omit<EliminatoriasSectionDTO, 'id' | 'organizadorId' | 'status' | 'setupStatus' | 'issues'>
  calendar: { dataInicio: string | null; dataFim: string | null; locais: Array<Omit<LigaLocalDTO, 'ordem'>> }
  registration: {
    inscricoesAbertas: boolean
    inscricoesAberturaEm: string | null
    inscricoesEncerramentoEm: string | null
    limiteEquipes: number | null
    equipesAprovadas: number
    inscricaoAprovacaoAutomatica: boolean
    elencoQuantidadeMinima: number | null
    elencoQuantidadeMaxima: number | null
    qrCodeEnabled: boolean
    formularioInscricaoConfig: FormularioInscricaoConfig | null
  }
  recursos: ChampionshipSetupResourcesDTO
  estimativaPartidas: MatchEstimateDTO
  partidasGeradas: number
  pricing: PricingDTO
  pagamentoConfirmadoEm: string | null
  progress: ChampionshipSetupProgressDTO
  sectionStatus: Record<SetupSection, ChampionshipSetupStatus>
  validation: { isValid: boolean; canPublish: boolean; errors: ValidationIssueDTO[]; warnings: ValidationIssueDTO[] }
}
