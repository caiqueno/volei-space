/**
 * Pedidos de interrupção regular (tempo e substituição) numa mesma interrupção. Módulo PURO.
 *
 *  - RG-TMP-003 (15.2.1, 15.2.2): na mesma interrupção cabem um ou dois tempos e UM pedido de substituição
 *    (vários jogadores no mesmo pedido são permitidos); dois pedidos de substituição seguidos não.
 *  - RG-TMP-005 (15.11.2, 15.11.3): o primeiro pedido indevido da equipe, que não atrasa o jogo, é rejeitado e
 *    registrado, sem consequência; os seguintes são atraso (RG-TMP-007/008).
 *  - RG-TMP-006 (15.2.4): pedido rejeitado e sancionado com ADVERTÊNCIA de atraso: a equipe não pode pedir outra
 *    interrupção regular até o fim do próximo rally concluído.
 *
 * A substituição excepcional (RG-SUB-011) e a troca de líbero não são "pedido regular" e ficam fora destas regras.
 */
import { bloqueio, ok, type CodigoRegra, type ResultadoRegra } from './tipos'

export type TipoPedidoRegular = 'TEMPO' | 'SUBSTITUICAO'

/** Pedidos de UMA equipe desde o último rally concluído (a "interrupção" corrente). */
export interface PedidosNaInterrupcao {
  tempos: number
  substituicoes: number
  /** RG-TMP-006: advertência de atraso por pedido indevido; vale até o fim do próximo rally concluído. */
  bloqueada: boolean
}

/** Quantos tempos cabem em sequência na mesma interrupção (15.2.1). */
export const MAX_TEMPOS_NA_SEQUENCIA = 2
/** Quantos pedidos de substituição regulares cabem na mesma interrupção (15.2.2). */
export const MAX_PEDIDOS_SUBSTITUICAO_NA_SEQUENCIA = 1

export function interrupcaoVazia(): PedidosNaInterrupcao {
  return { tempos: 0, substituicoes: 0, bloqueada: false }
}

/** RG-TMP-003 / RG-TMP-006: o pedido cabe na interrupção corrente? */
export function validarPedidoNaInterrupcao(
  estado: PedidosNaInterrupcao,
  pedido: { tipo: TipoPedidoRegular },
): ResultadoRegra {
  if (estado.bloqueada) {
    return bloqueio(
      'RG-TMP-006',
      'A equipe recebeu advertência de atraso por pedido indevido: não pode pedir outra interrupção regular até o fim do próximo rally concluído.',
    )
  }
  if (pedido.tipo === 'TEMPO' && estado.tempos >= MAX_TEMPOS_NA_SEQUENCIA) {
    return bloqueio('RG-TMP-003', `Na mesma interrupção cabem no máximo ${MAX_TEMPOS_NA_SEQUENCIA} tempos seguidos: o próximo pedido é indevido.`)
  }
  if (pedido.tipo === 'SUBSTITUICAO' && estado.substituicoes >= MAX_PEDIDOS_SUBSTITUICAO_NA_SEQUENCIA) {
    return bloqueio(
      'RG-TMP-003',
      'Na mesma interrupção cabe um pedido de substituição (com vários jogadores, se for o caso); dois pedidos seguidos não são permitidos.',
    )
  }
  return ok()
}

export function registrarPedidoNaInterrupcao(estado: PedidosNaInterrupcao, tipo: TipoPedidoRegular): PedidosNaInterrupcao {
  return tipo === 'TEMPO' ? { ...estado, tempos: estado.tempos + 1 } : { ...estado, substituicoes: estado.substituicoes + 1 }
}

/** Um rally foi concluído: a interrupção acabou e o bloqueio de RG-TMP-006 cai. */
export function encerrarInterrupcao(): PedidosNaInterrupcao {
  return interrupcaoVazia()
}

export type ConsequenciaPedidoIndevido = 'REGISTRO_SEM_SANCAO' | 'ATRASO'

export interface ClassificacaoPedidoIndevido {
  consequencia: ConsequenciaPedidoIndevido
  codigo: CodigoRegra
  /** Sanção de atraso a lançar (RG-TMP-007/008); null no primeiro indevido sem atraso. */
  sancaoSugerida: 'ADVERTENCIA_ATRASO' | 'PENALIDADE_ATRASO' | null
  /** RG-TMP-006: a advertência de atraso bloqueia novo pedido regular até o fim do próximo rally. */
  bloqueiaNovosPedidos: boolean
  mensagem: string
}

/**
 * RG-TMP-005: classifica um pedido indevido.
 * @param indevidosAnterioresSemAtraso pedidos indevidos já registrados pela equipe na partida que não atrasaram o jogo
 * @param atrasosAnteriores sanções de atraso (advertência ou penalidade) já aplicadas à equipe na partida
 * @param atrasaOJogo o pedido, além de indevido, atrasou o jogo (vai direto a atraso)
 */
export function classificarPedidoIndevido(params: {
  indevidosAnterioresSemAtraso: number
  atrasosAnteriores: number
  atrasaOJogo?: boolean
}): ClassificacaoPedidoIndevido {
  const primeiroSemAtraso = params.atrasaOJogo !== true && params.indevidosAnterioresSemAtraso === 0
  if (primeiroSemAtraso) {
    return {
      consequencia: 'REGISTRO_SEM_SANCAO',
      codigo: 'RG-TMP-005',
      sancaoSugerida: null,
      bloqueiaNovosPedidos: false,
      mensagem: 'Primeiro pedido indevido da equipe na partida, sem atrasar o jogo: é rejeitado e registrado, sem consequência.',
    }
  }
  const advertencia = params.atrasosAnteriores === 0
  return {
    consequencia: 'ATRASO',
    codigo: 'RG-TMP-005',
    sancaoSugerida: advertencia ? 'ADVERTENCIA_ATRASO' : 'PENALIDADE_ATRASO',
    bloqueiaNovosPedidos: advertencia,
    mensagem: advertencia
      ? 'Pedido indevido repetido (ou que atrasa o jogo): atraso. É a primeira sanção de atraso da equipe: advertência (RG-TMP-007); sem novo pedido regular até o fim do próximo rally (RG-TMP-006).'
      : 'Pedido indevido repetido (ou que atrasa o jogo): atraso. A equipe já foi sancionada por atraso: penalidade, ponto e saque ao adversário (RG-TMP-008).',
  }
}
