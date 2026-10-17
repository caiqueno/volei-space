/**
 * Posições dos jogadores no golpe do saque. RG-POS-001, RG-POS-002, RG-POS-005. Módulo PURO.
 *
 * O árbitro mede pelos pés em contato com o solo (7.4). O motor recebe duas medidas por jogador, que a tela ou o
 * apontador informa quando há dúvida: `x` (da esquerda para a direita, de frente para a rede) e `y` (distância da rede).
 * Índice 0 = posição I ... 5 = posição VI.
 */
import { consequenciaSubstituicaoIlegal, type ConsequenciaSubstituicaoIlegal } from './substituicoes'
import type { PontoLog } from './rotacao'
import { bloqueio, ok, type Equipe, type ResultadoRegra } from './tipos'

export interface PosicaoNaQuadra {
  x: number
  y: number
}

/** Jogador de trás -> jogador da frente que ele precisa ficar mais afastado da rede: I/II, VI/III, V/IV. */
const PARES_FUNDO_FRENTE: ReadonlyArray<readonly [number, number, string]> = [
  [0, 1, 'I atrás do II'],
  [5, 2, 'VI atrás do III'],
  [4, 3, 'V atrás do IV'],
]

/** Ordem lateral esperada, da esquerda para a direita: IV-III-II na frente e V-VI-I no fundo. */
const FILAS_LATERAIS: ReadonlyArray<readonly [number, number, number, string]> = [
  [3, 2, 1, 'IV, III e II (frente)'],
  [4, 5, 0, 'V, VI e I (fundo)'],
]

/**
 * RG-POS-001 / RG-POS-002: no golpe do saque a equipe RECEPTORA precisa estar na ordem de rotação (cada jogador de trás
 * mais afastado da rede que o da frente correspondente; laterais na ordem 4-3-2 e 5-6-1). A equipe SACADORA pode ocupar
 * qualquer posição relativa: não há falta de posição por parte dela.
 */
export function validarPosicoesNoSaque(params: {
  equipe: Equipe
  /** Equipe que está sacando. */
  saca: Equipe
  posicoes: readonly PosicaoNaQuadra[]
}): ResultadoRegra {
  if (params.equipe === params.saca) return ok()
  if (params.posicoes.length !== 6) {
    return bloqueio('RG-POS-001', 'Informe as 6 posições (I a VI) da equipe receptora.')
  }
  for (const [fundo, frente, descricao] of PARES_FUNDO_FRENTE) {
    if (!(params.posicoes[fundo]!.y > params.posicoes[frente]!.y)) {
      return bloqueio('RG-POS-001', `Falta de posição da equipe ${params.equipe}: o ${descricao}; cada jogador de trás deve estar mais afastado da rede que o da frente.`)
    }
  }
  for (const [esquerda, centro, direita, descricao] of FILAS_LATERAIS) {
    const p = params.posicoes
    if (!(p[esquerda]!.x < p[centro]!.x && p[centro]!.x < p[direita]!.x)) {
      return bloqueio('RG-POS-001', `Falta de posição da equipe ${params.equipe}: ${descricao} devem estar na ordem lateral correta, da esquerda para a direita.`)
    }
  }
  return ok()
}

export interface FaltaDePosicaoPorSubstituicaoIlegal {
  codigo: 'RG-POS-005'
  /** Conta como falta de posição com as consequências da substituição ilegal. */
  consequencia: ConsequenciaSubstituicaoIlegal
  mensagem: string
}

/**
 * RG-POS-005: jogador em quadra por substituição ilegal quando o jogo é reiniciado = falta de posição com as consequências
 * de RG-SUB-009 (ponto e saque ao adversário e cancelamento dos pontos da faltosa desde a substituição).
 * Descoberta ANTES do reinício vale só o atraso (RG-SUB-009).
 */
export function faltaDePosicaoPorSubstituicaoIlegal(params: {
  equipeFaltosa: Equipe
  jogoReiniciado: boolean
  momentoSeq: number | null
  pontosDoSet: readonly PontoLog[]
}): FaltaDePosicaoPorSubstituicaoIlegal {
  const consequencia = consequenciaSubstituicaoIlegal({
    equipeFaltosa: params.equipeFaltosa,
    descobertaAntesDoReinicio: !params.jogoReiniciado,
    momentoSeq: params.momentoSeq,
    pontosDoSet: params.pontosDoSet,
  })
  return {
    codigo: 'RG-POS-005',
    consequencia,
    mensagem: params.jogoReiniciado
      ? `Jogador em quadra por substituição ilegal com o jogo reiniciado: conta como falta de posição da equipe ${params.equipeFaltosa}, com as consequências da substituição ilegal. ${consequencia.mensagem}`
      : consequencia.mensagem,
  }
}
