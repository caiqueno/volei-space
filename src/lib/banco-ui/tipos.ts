/** Tipos do app do banco (contrato com GET /api/banco/[token]). Módulo PURO. */

export type EstadoPapeleta = 'RASCUNHO' | 'ENVIADA' | 'ACEITA'
export type EstadoPedido = 'PENDENTE' | 'ACEITO' | 'RECUSADO' | 'CANCELADO'
export type TipoPedido = 'TEMPO' | 'SUBSTITUICAO'

export interface JogadorBanco {
  jogadorId: number
  nome: string
  numero: number | null
}

export interface SlotFormacao {
  /** 1..6 = posições I..VI. */
  posicao: number
  jogadorId: number
}

export interface PapeletaBanco {
  setNumero: number
  estado: EstadoPapeleta
  formacao: SlotFormacao[]
  liberoId: number | null
  libero2Id?: number | null
  capitaoId: number | null
}

export interface PedidoBanco {
  id: number | string
  tipo: TipoPedido | 'DESAFIO'
  estado: EstadoPedido
  payload: { sai?: number; entra?: number; motivo?: string } | null
  criadoEm: string
}

export interface VisaoBanco {
  partida: { id: number; equipeA: unknown; equipeB: unknown; status: string; placar: unknown }
  equipe: { id: number; nome: string }
  elenco: JogadorBanco[]
  papeletas: PapeletaBanco[]
  pedidos: PedidoBanco[]
  limites: { tempos: number; substituicoes: number }
}

/** Rascunho local: posição (1..6) -> jogador (ou null se vazia). */
export interface RascunhoPapeleta {
  slots: Record<number, number | null>
  liberoId: number | null
  capitaoId: number | null
  /** Segundo líbero, opcional: só vale com elenco acima de 12 atletas. */
  libero2Id?: number | null
}

export interface Violacao {
  codigo: string
  mensagem: string
  /** Problema do elenco (quem pode jogar) ou da formação (como está escalado). Vazio = não classificado. */
  grupo?: 'elenco' | 'formacao'
}
