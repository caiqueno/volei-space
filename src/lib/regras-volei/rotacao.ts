/**
 * Rotação, ordem de saque, falta de posição e falta de rotação com reversão
 * seletiva de pontos (CJ-03). RG-SAQ-*, RG-POS-*, RG-ROT-*.
 */
import { CONFIG_ITENS_M } from './config'
import { bloqueio, ok, outraEquipe, type Equipe, type Formacao, type ResultadoRegra } from './tipos'

/** Posições de fundo (índices): I (0), VI (5), V (4). Posições de frente: II, III, IV. */
export const INDICES_FUNDO: readonly number[] = [0, 4, 5]

export function ehPosicaoDeFundo(indice: number): boolean {
  return INDICES_FUNDO.includes(indice)
}

/** RG-FOR-005: exatamente 6 jogadores distintos nas posições I a VI. */
export function validarFormacaoInicial(formacao: Formacao): ResultadoRegra {
  if (formacao.length !== 6) {
    return bloqueio('RG-FOR-005', 'A formação inicial precisa de exatamente 6 jogadores nas posições I a VI.')
  }
  if (new Set(formacao).size !== 6) {
    return bloqueio('RG-FOR-005', 'A formação inicial não pode repetir jogador.')
  }
  return ok()
}

/** RG-SAQ-002: rodízio horário (2 -> 1, 1 -> 6, 6 -> 5, 5 -> 4, 4 -> 3, 3 -> 2). */
export function rodar(formacao: Formacao): number[] {
  return formacao.map((_, i) => formacao[(i + 1) % formacao.length]!)
}

export function sacadorDaFormacao(formacao: Formacao): number {
  return formacao[0]!
}

export interface EstadoSaque {
  formacaoA: Formacao
  formacaoB: Formacao
  saca: Equipe
}

/** RG-SAQ-001/002: quem vence o rally; quem sacava mantém o saque, quem recebia ganha e roda. */
export function aplicarRally(estado: EstadoSaque, vencedor: Equipe): EstadoSaque {
  if (vencedor === estado.saca) return estado
  return {
    saca: vencedor,
    formacaoA: vencedor === 'A' ? rodar(estado.formacaoA) : estado.formacaoA,
    formacaoB: vencedor === 'B' ? rodar(estado.formacaoB) : estado.formacaoB,
  }
}

/** RG-SAQ-004 / RG-ROT-001: o sacador precisa ser o jogador da posição I da equipe que saca. */
export function validarSacador(estado: EstadoSaque, jogadorQueSacou: number): ResultadoRegra {
  const formacao = estado.saca === 'A' ? estado.formacaoA : estado.formacaoB
  const esperado = sacadorDaFormacao(formacao)
  if (jogadorQueSacou !== esperado) {
    return bloqueio(
      'RG-ROT-001',
      `Saque fora da ordem: a equipe ${estado.saca} deveria sacar com o jogador ${esperado}, mas sacou o ${jogadorQueSacou}. Ponto e saque ao adversário, rodízio retificado.`,
    )
  }
  return ok()
}

export interface ConsequenciaFalta {
  pontoParaAdversario: number
  saqueParaAdversario: boolean
  cancelaPontosAnteriores: boolean
  codigo: `RG-${string}-${string}`
  mensagem: string
}

/** RG-POS-003: falta de posição = ponto e saque ao adversário; NUNCA cancela pontos anteriores. */
export function consequenciaFaltaDePosicao(equipeFaltosa: Equipe): ConsequenciaFalta {
  return {
    pontoParaAdversario: 1,
    saqueParaAdversario: true,
    cancelaPontosAnteriores: false,
    codigo: 'RG-POS-003',
    mensagem: `Falta de posição da equipe ${equipeFaltosa}: ponto e saque para a equipe ${outraEquipe(equipeFaltosa)}, posições retificadas. Nenhum ponto anterior é cancelado.`,
  }
}

/** RG-POS-004: falta de saque prevalece sobre falta de posição simultânea. */
export function decidirFaltaSimultanea(params: {
  faltaDoSacador: boolean
  faltaDePosicaoAdversaria: boolean
  saqueDepoisFalhou: boolean
}): 'FALTA_SAQUE' | 'FALTA_POSICAO' | 'NENHUMA' {
  if (params.faltaDoSacador && params.faltaDePosicaoAdversaria) return 'FALTA_SAQUE'
  if (params.faltaDePosicaoAdversaria) return 'FALTA_POSICAO' // inclui saque correto que depois falha (12.7)
  if (params.faltaDoSacador) return 'FALTA_SAQUE'
  return 'NENHUMA'
}

/* ------------------------------------------------------------------ */
/* Falta de rotação: reversão seletiva (RG-ROT-001..005, CJ-03)       */
/* ------------------------------------------------------------------ */

export interface PontoLog {
  /** seq do evento que gerou o ponto (ordem cronológica no log). */
  seq: number
  equipe: Equipe
}

export interface FaltaRotacao {
  equipeFaltosa: Equipe
  /**
   * seq do primeiro ponto/evento a partir do qual a falta ocorreu. `null` = momento NÃO
   * determinável (RG-ROT-003): só ponto e saque, sem cancelamento.
   *
   * DEFINIÇÃO: pela regra 7.7.2 só se cancelam os pontos da equipe faltosa conquistados desde o
   * rally em que ela sacou fora da ordem de rodízio; o `momentoSeq` é o seq do ponto que encerrou
   * esse rally (ou o primeiro posterior à falta), e quem o informa é o árbitro. O placar exato
   * depois do cancelamento é item [M] (CJ-03) e NÃO deve ser tratado como oficial.
   * PENDENTE: a formação ainda não é recalculada por replay dos pontos vivos; só `formacaoCorrigida`.
   */
  momentoSeq: number | null
  /**
   * RG-ROT-004: se o rally que começou com a falta já terminou, seq do ponto que ele gerou.
   * O adversário recebe UM único ponto, qualquer que tenha sido o resultado desse rally.
   */
  pontoDoRallyDaFaltaSeq?: number | null
}

export interface ReversaoRotacao {
  /** seq dos pontos cancelados (somente da equipe faltosa; os do adversário permanecem). */
  cancelados: number[]
  pontoParaAdversario: number
  saqueParaAdversario: boolean
  /** RG-ROT-005: havendo cancelamento, a súmula manual abre "súmula anexa" do set. */
  precisaSumulaAnexa: boolean
  codigos: Array<`RG-${string}-${string}`>
  mensagem: string
}

export function calcularReversaoFaltaRotacao(pontosDoSet: readonly PontoLog[], falta: FaltaRotacao): ReversaoRotacao {
  const adversario = outraEquipe(falta.equipeFaltosa)
  const cancelados: number[] = []
  const codigos: ReversaoRotacao['codigos'] = ['RG-ROT-001']

  if (falta.momentoSeq !== null) {
    codigos.push('RG-ROT-002')
    for (const ponto of pontosDoSet) {
      if (ponto.equipe === falta.equipeFaltosa && ponto.seq >= falta.momentoSeq) cancelados.push(ponto.seq)
    }
  } else {
    codigos.push('RG-ROT-003')
  }

  if (falta.pontoDoRallyDaFaltaSeq != null) {
    codigos.push('RG-ROT-004')
    const pontoDoRally = pontosDoSet.find((p) => p.seq === falta.pontoDoRallyDaFaltaSeq)
    // Se o adversário ganhou esse rally, o ponto dele é absorvido: ele recebe apenas UM ponto.
    if (pontoDoRally && pontoDoRally.equipe === adversario && !cancelados.includes(pontoDoRally.seq)) {
      cancelados.push(pontoDoRally.seq)
    }
  }

  cancelados.sort((x, y) => x - y)
  const qtde = cancelados.filter((seq) => pontosDoSet.find((p) => p.seq === seq)?.equipe === falta.equipeFaltosa).length
  const mensagem =
    falta.momentoSeq === null
      ? `Falta de rotação da equipe ${falta.equipeFaltosa} sem momento determinável: só ponto e saque para ${adversario}, nenhum ponto é cancelado.`
      : `Falta de rotação da equipe ${falta.equipeFaltosa}: ${qtde} ponto(s) dela cancelado(s) desde o momento da falta; os pontos de ${adversario} permanecem e ${adversario} recebe ponto e saque.`

  if (cancelados.length > 0) codigos.push('RG-ROT-005')
  return {
    cancelados,
    pontoParaAdversario: CONFIG_ITENS_M.faltaRotacaoPontoAdversario,
    saqueParaAdversario: true,
    precisaSumulaAnexa: cancelados.length > 0,
    codigos,
    mensagem,
  }
}

/* ------------------------------------------------------------------ */
/* Replay do rodízio (RG-ROT-001/002)                                  */
/* ------------------------------------------------------------------ */

export type PassoReplay =
  | { tipo: 'PONTO'; equipe: Equipe; cancelado: boolean }
  | { tipo: 'TROCA'; equipe: Equipe; sai: number; entra: number }

/**
 * Recalcula quem saca e as duas formações PARTINDO da formação inicial do set e reaplicando, em ordem,
 * só os pontos vivos e as trocas de jogadores (substituição, líbero, redesignação). É o que "retifica o
 * rodízio" depois de a reversão cancelar pontos da equipe faltosa: os rodízios ganhos em side-outs
 * cancelados deixam de existir. Função pura e determinística.
 */
export function reconstruirRodizio(inicio: EstadoSaque, passos: readonly PassoReplay[]): EstadoSaque {
  let estado: EstadoSaque = { formacaoA: [...inicio.formacaoA], formacaoB: [...inicio.formacaoB], saca: inicio.saca }
  for (const passo of passos) {
    if (passo.tipo === 'PONTO') {
      if (!passo.cancelado) estado = aplicarRally(estado, passo.equipe)
      continue
    }
    const troca = (f: Formacao) => f.map((j) => (j === passo.sai ? passo.entra : j))
    estado = passo.equipe === 'A' ? { ...estado, formacaoA: troca(estado.formacaoA) } : { ...estado, formacaoB: troca(estado.formacaoB) }
  }
  return estado
}
