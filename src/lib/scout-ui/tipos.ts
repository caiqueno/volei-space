/** Tipos e textos do scout manual na tela (contrato com /api/scout/[token]/acoes). Módulo PURO. */
import { FUNDAMENTOS, RESULTADOS, type Fundamento, type ResultadoAcao } from '../scout/modelo'

export { FUNDAMENTOS, RESULTADOS }
export type { Fundamento, ResultadoAcao }

export interface JogadorScout {
  id: number
  numero: number | null
  /** Só para exibir na tela do aparelho; nunca vai no payload. */
  nome: string
}

export interface EquipeScoutTela {
  id: number
  lado: 'A' | 'B'
  nome: string
  jogadores: JogadorScout[]
}

export interface PayloadAcao {
  clientEventId: string
  setNumero: number
  equipeId: number
  jogadorId?: number
  fundamento: Fundamento
  resultado: ResultadoAcao
  zonaOrigem?: number
  zonaDestino?: number
  rotacao?: number
  placarA?: number
  placarB?: number
}

/** Ação como o servidor devolve (campos opcionais por tolerância ao contrato). */
export interface AcaoServidor {
  id: number | string
  clientEventId?: string
  setNumero?: number
  set?: number
  equipeId?: number
  jogadorId?: number | null
  fundamento: Fundamento
  resultado: ResultadoAcao
  zonaOrigem?: number | null
  zonaDestino?: number | null
}

export const ROTULO_FUNDAMENTO: Readonly<Record<Fundamento, string>> = {
  SAQUE: 'Saque',
  RECEPCAO: 'Recepção',
  LEVANTAMENTO: 'Levantamento',
  ATAQUE: 'Ataque',
  BLOQUEIO: 'Bloqueio',
  DEFESA: 'Defesa',
  CONTRA_ATAQUE: 'Contra-ataque',
}

export const ROTULO_RESULTADO: Readonly<Record<ResultadoAcao, string>> = {
  PONTO: 'Ponto',
  ERRO: 'Erro',
  CONTINUA: 'Continua',
  NEUTRO: 'Neutro',
}
