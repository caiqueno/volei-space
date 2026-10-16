// Tipos da súmula impressa. A entrada é a projeção de leitura da súmula
// (sumulaParaConsulta); a saída é o modelo que a página de impressão desenha.

export type JogadorRegistro = {
  id: number
  nome: string
  numero?: number | string | null
  numeroHerdado?: number | null
  posicao?: string | null
}

export type EquipeRegistro = {
  id: number
  nome: string
  jogadores?: JogadorRegistro[]
}

export type OcorrenciaRegistro = {
  id: number
  tipo?: string | null
  descricao?: string | null
  set?: number | null
  jogadorId?: number | null
}

export type PresencaRegistro = {
  presente: boolean
  equipeId: number
  jogadorId: number
  numero?: number | string | null
}

export type RegistroSumula = {
  id: number
  status?: string | null
  rodada?: number | null
  fase?: string | null
  categoria?: string | null
  dataHora?: string | null
  localNome?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  vencedorId?: number | null
  liga?: { nome?: string | null } | null
  equipeA?: EquipeRegistro | null
  equipeB?: EquipeRegistro | null
  sets?: Array<{ id?: number; numero: number; pontosA: number; pontosB: number }>
  presencas?: PresencaRegistro[]
  ocorrencias?: OcorrenciaRegistro[]
  destaques?: Array<{ id?: number; tipo: string; jogador?: JogadorRegistro | null }>
  escala?: Array<{ id?: number; cargo?: string | null; arbitro?: { nome?: string | null } | null }>
}

export type Lado = 'A' | 'B'

export type AtletaImpresso = {
  jogadorId: number
  camisa: string
  nome: string
  capitao: boolean
  libero: boolean
}

export type EquipeImpressa = {
  lado: Lado
  nome: string
  atletas: AtletaImpresso[]
}

export type EventoImpresso = {
  id: number
  hora: string
  placar: string
  texto: string
  lado: Lado | null
  /** Registro feito por decisão do árbitro, fora do motor de regras: "código: justificativa". */
  decisaoArbitro?: string | null
}

export type PosicaoFormacao = { posicao: string; camisa: string; nome: string }

export type SetImpresso = {
  numero: number
  pontosA: number
  pontosB: number
  vencedor: Lado | null
  sacador: Lado | null
  formacaoA: PosicaoFormacao[] | null
  formacaoB: PosicaoFormacao[] | null
  liberoA: string | null
  liberoB: string | null
  inicio: string | null
  fim: string | null
  duracaoMin: number | null
  tempos: EventoImpresso[]
  substituicoes: EventoImpresso[]
  tempoA: number
  tempoB: number
  substA: number
  substB: number
}

export type ArbitroImpresso = { cargo: string; nome: string }

export type ModeloImpressao = {
  campeonato: string
  categoria: string
  fase: string
  data: string
  local: string
  arbitros: ArbitroImpresso[]
  equipeA: EquipeImpressa
  equipeB: EquipeImpressa
  sets: SetImpresso[]
  sancoes: Array<EventoImpresso & { set: number | null }>
  observacoes: Array<EventoImpresso & { set: number | null }>
  /** Todos os registros marcados como decisão do árbitro (override), em ordem cronológica. */
  decisoesDoArbitro: Array<EventoImpresso & { set: number | null }>
  setsA: number
  setsB: number
  totalPontosA: number
  totalPontosB: number
  duracaoTotalMin: number | null
  vencedor: string | null
  mvp: string[]
  encerrada: boolean
}
