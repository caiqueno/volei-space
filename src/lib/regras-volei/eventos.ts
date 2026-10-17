/**
 * Log de eventos imutável da súmula (event sourcing) e derivação do placar. J02.
 *
 * Princípios:
 *  - O log só cresce (append-only): nada é editado nem apagado.
 *  - "Desfazer" é um NOVO evento DESFAZ com `desfazId` = seq do evento anulado.
 *  - `clientEventId` torna o envio idempotente (reenvio offline não duplica ponto).
 *  - Placar, saque, rotação e contadores são DERIVADOS do log por funções puras.
 *
 * Códigos RG-LOG-* são do motor (não constam no 03): ver docs/analise/07-arquitetura-backend.md.
 */
import type { ConfigPartida } from './config'
import {
  criarEstadoEquipe,
  iniciarNovoSet,
  jogadorImpedido,
  registrarRallyConcluido,
  type EstadoEquipe,
} from './estado-equipe'
import { aplicarTrocaLibero, aplicarRedesignacaoLibero, validarSaqueDoLibero, type MomentoDaTroca } from './libero'
import { aplicarRally, calcularReversaoFaltaRotacao, reconstruirRodizio, validarSacador, type PassoReplay, type PontoLog } from './rotacao'
import { avaliarSancao, registrarSancao, type CategoriaSancao, type SancaoRegistrada } from './sancoes'
import { alvoDoSet, deveTrocarDeLado, ehSetDecisivo, partidaEncerrada, setEncerrado, validarPedidoDeTempo } from './set-partida'
import { aplicarSubstituicaoExcepcional, aplicarSubstituicaoLote, type MotivoExcepcional } from './substituicoes'
import { decidirInterrupcao, resolverEquipeIncompleta, resolverWO, type ResultadoWO } from './wo-interrupcao'
import {
  bloqueio,
  outraEquipe,
  type CodigoRegra,
  type Equipe,
  type PlacarSet,
  type RegraBloqueio,
} from './tipos'
import type { AcaoInterrupcao } from './wo-interrupcao'
import { capitaoEmJogo, validarDesignacaoDeCapitao } from './elenco'
import { calcularPerdaPorNaoRegistrado } from './nao-registrado'
import {
  classificarPedidoIndevido,
  interrupcaoVazia,
  registrarPedidoNaInterrupcao,
  validarPedidoNaInterrupcao,
  type ClassificacaoPedidoIndevido,
  type PedidosNaInterrupcao,
} from './pedidos'
import { consequenciaDeDiscrepancia, type CausaDiscrepancia, type FaseDiscrepancia } from './papeleta'

/** `FALTA_DUPLA` (RG-PTO-002): faltas simultâneas de adversários; o rally se repete sem ponto. */
export type MotivoRallyRepetido = 'ACIDENTE_COM_BOLA_EM_JOGO' | 'INTERFERENCIA_EXTERNA' | 'FALTA_DUPLA' | 'OUTRO'

/** Protestos como eventos (RG-PRO-001..003): o motor só registra; o mérito é do órgão do regulamento. */
export interface ProtestoDerivado {
  /** seq do PROTESTO_ANUNCIADO (ou do registro/desistência sem anúncio). */
  seq: number
  equipe: Equipe
  estado: 'ANUNCIADO' | 'REGISTRADO' | 'DESISTIDO'
  relato: string | null
  anunciadoEm: number | null
  resolvidoEm: number | null
}

/** Pedido indevido registrado (RG-TMP-005): o motor classifica e sugere a sanção; quem lança a SANCAO é o apontador. */
export interface PedidoIndevidoDerivado {
  seq: number
  equipe: Equipe
  tipo: 'TEMPO' | 'SUBSTITUICAO' | 'LIBERO' | 'OUTRO'
  consequencia: ClassificacaoPedidoIndevido['consequencia']
  sancaoSugerida: ClassificacaoPedidoIndevido['sancaoSugerida']
}

export interface DiscrepanciaPapeletaDerivada {
  seq: number
  equipe: Equipe
  fase: FaseDiscrepancia
  causa: CausaDiscrepancia
  codigo: CodigoRegra
  jogador: number | null
}

/* ------------------------------ tipos do log ------------------------------ */

export interface PayloadPorTipo {
  SET_INICIADO: {
    numeroSet: number
    formacaoA: number[]
    formacaoB: number[]
    saqueInicial: Equipe
    /** Líberos registrados na relação nominal (lidos no 1º set da partida). */
    liberosA?: number[]
    liberosB?: number[]
  }
  /** `sacador` (opcional): jogador que sacou o rally; o servidor confere a ordem de saque (RG-ROT-001). */
  PONTO: { equipe: Equipe; sacador?: number }
  /** RG-INT-001 (acidente com bola em jogo) / RG-INT-002 (interferência externa): sem ponto, mantém o sacador. */
  RALLY_REPETIDO: { motivo?: MotivoRallyRepetido }
  /** Uma troca (`sai`/`entra`) ou várias no mesmo pedido (`trocas`, RG-SUB-007). */
  SUBSTITUICAO: {
    equipe: Equipe
    sai?: number
    entra?: number
    trocas?: Array<{ sai: number; entra: number }>
    excepcional?: boolean
    motivo?: string
  }
  TEMPO: { equipe: Equipe }
  /**
   * RG-TMP-005: pedido de tempo/substituição/troca rejeitado por indevido (fora de hora, acima do limite...).
   * O primeiro da equipe na partida, sem atrasar o jogo, é só registrado; os seguintes são atraso (a SANCAO é lançada à parte).
   */
  PEDIDO_INDEVIDO: { equipe: Equipe; tipo?: 'TEMPO' | 'SUBSTITUICAO' | 'LIBERO' | 'OUTRO'; atrasaOJogo?: boolean }
  TROCA_LIBERO: { equipe: Equipe; sai: number; entra: number; momento?: MomentoDaTroca }
  REDESIGNACAO_LIBERO: { equipe: Equipe; liberoIncapaz: number; novoLibero: number }
  SANCAO: {
    equipe: Equipe
    membro: string
    categoria: string
    sancao: string
    pontoParaAdversario: boolean
    /** Sanção entre sets: o ponto é lançado no 0x0 do set seguinte (RG-SAN-010). */
    entreSets?: boolean
  }
  FALTA_POSICAO: { equipeFaltosa: Equipe }
  FALTA_ROTACAO: {
    equipeFaltosa: Equipe
    /** seq do 1º evento da equipe faltosa a cancelar; null = momento indeterminável. */
    momentoSeq: number | null
    pontoDoRallyDaFaltaSeq?: number | null
    formacaoCorrigida?: number[]
  }
  TROCA_LADO: Record<string, never>
  SET_ANULADO: { motivo?: string }
  INTERRUPCAO: { minutos: number; motivo: string; acao: AcaoInterrupcao }
  WO: { ausente: Equipe | 'AMBAS' }
  EQUIPE_INCOMPLETA: { equipe: Equipe; escopo: 'SET' | 'JOGO' }
  OBSERVACAO: { texto: string }
  /**
   * Papeleta x quadra (RG-FOR-007/008/009). `fase` ANTES_DO_SET: só corrige, sem sanção.
   * DEPOIS_DO_INICIO: reversão seletiva dos pontos da equipe faltosa desde `momentoSeq`.
   */
  DISCREPANCIA_PAPELETA: {
    equipe: Equipe
    fase: FaseDiscrepancia
    causa: CausaDiscrepancia
    jogador?: number
    /** Com `setEntrada`: seq, dentro desse set, do primeiro ponto da faltosa a cancelar. */
    momentoSeq?: number | null
    pontoDoRallyDaFaltaSeq?: number | null
    formacaoCorrigida?: number[]
    /**
     * RG-FOR-009 completo: set (anterior ao corrente) em que o jogador não registrado entrou. Só vale com
     * causa JOGADOR_NAO_REGISTRADO e fase DEPOIS_DO_INICIO; omitido ou igual ao set corrente = só o set corrente.
     */
    setEntrada?: number
  }
  /** RG-ELE-005: designação do capitão em jogo quando o capitão da equipe não está em quadra. */
  CAPITAO_EM_JOGO: { equipe: Equipe; jogador: number }
  /** RG-PRO-001: o capitão em jogo anuncia, na hora, que se reserva o direito de protestar. */
  PROTESTO_ANUNCIADO: { equipe: Equipe; jogador?: number; motivo?: string }
  /** RG-PRO-002: protesto formalizado ao fim da partida, com o relato. O motor NÃO decide o mérito (RG-PRO-004). */
  PROTESTO_REGISTRADO: { equipe: Equipe; relato: string; anunciadoSeq?: number | null }
  /** RG-PRO-003: o capitão decidiu não formalizar o protesto anunciado. */
  PROTESTO_DESISTIDO: { equipe: Equipe; anunciadoSeq?: number | null }
  DESFAZ: Record<string, never>
}

export type SumulaEventoTipo = keyof PayloadPorTipo

interface EventoBase {
  /** Sequência estritamente crescente e contígua, atribuída no servidor. */
  readonly seq: number
  /** UUID gerado no cliente: idempotência do reenvio. */
  readonly clientEventId: string
  /** Em DESFAZ: seq do evento anulado. Nos demais: null. */
  readonly desfazId: number | null
  readonly criadoEm?: string
}

export type SumulaEvento = {
  [K in SumulaEventoTipo]: EventoBase & { readonly tipo: K; readonly payload: Readonly<PayloadPorTipo[K]> }
}[SumulaEventoTipo]

export type NovoEvento = {
  [K in SumulaEventoTipo]: {
    tipo: K
    payload: PayloadPorTipo[K]
    clientEventId: string
    desfazId?: number | null
    criadoEm?: string
  }
}[SumulaEventoTipo]

export type ResultadoAnexar =
  | { ok: true; log: readonly SumulaEvento[]; evento: SumulaEvento; duplicado: boolean }
  | RegraBloqueio

/* ------------------------------- operações -------------------------------- */

function congelar<T>(valor: T): T {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor)
    for (const v of Object.values(valor as Record<string, unknown>)) congelar(v)
  }
  return valor
}

/** seqs que foram desfeitos por eventos DESFAZ. */
export function seqsDesfeitos(log: readonly SumulaEvento[]): Set<number> {
  const s = new Set<number>()
  for (const e of log) if (e.tipo === 'DESFAZ' && e.desfazId !== null) s.add(e.desfazId)
  return s
}

/** Eventos que valem para a derivação: sem os DESFAZ e sem os desfeitos. */
export function eventosEfetivos(log: readonly SumulaEvento[]): SumulaEvento[] {
  const desfeitos = seqsDesfeitos(log)
  return log.filter((e) => e.tipo !== 'DESFAZ' && !desfeitos.has(e.seq))
}

/** RG-LOG-004: o log precisa ter seq contígua a partir de 1. */
export function validarLog(log: readonly SumulaEvento[]): RegraBloqueio | null {
  const ids = new Set<string>()
  for (let i = 0; i < log.length; i += 1) {
    const e = log[i]!
    if (e.seq !== i + 1) return bloqueio('RG-LOG-004', `Log inconsistente: esperado seq ${i + 1}, encontrado ${e.seq}.`)
    if (ids.has(e.clientEventId)) return bloqueio('RG-LOG-001', `clientEventId repetido no log: ${e.clientEventId}.`)
    ids.add(e.clientEventId)
  }
  return null
}

/**
 * Anexa um evento ao log (função pura: devolve um log NOVO; o original não muda).
 * Idempotente por `clientEventId`: reenvio devolve o evento já existente com `duplicado: true`.
 */
export function anexarEvento(log: readonly SumulaEvento[], novo: NovoEvento): ResultadoAnexar {
  if (!novo.clientEventId || typeof novo.clientEventId !== 'string') {
    return bloqueio('RG-LOG-001', 'Todo evento precisa de clientEventId para evitar duplicidade no reenvio.')
  }
  const existente = log.find((e) => e.clientEventId === novo.clientEventId)
  if (existente) return { ok: true, log, evento: existente, duplicado: true }

  const desfazId = novo.desfazId ?? null
  if (novo.tipo === 'DESFAZ') {
    if (desfazId === null) return bloqueio('RG-LOG-002', 'O evento DESFAZ precisa indicar qual evento desfaz (desfazId).')
    const alvo = log.find((e) => e.seq === desfazId)
    if (!alvo) return bloqueio('RG-LOG-002', `Não existe o evento ${desfazId} para desfazer.`)
    if (alvo.tipo === 'DESFAZ') return bloqueio('RG-LOG-003', 'Um desfazer não pode ser desfeito: lance o evento de novo.')
    if (seqsDesfeitos(log).has(desfazId)) return bloqueio('RG-LOG-003', `O evento ${desfazId} já foi desfeito.`)
  } else if (desfazId !== null) {
    return bloqueio('RG-LOG-002', 'Só o evento DESFAZ pode ter desfazId.')
  }

  const evento = congelar({
    seq: log.length + 1,
    tipo: novo.tipo,
    payload: { ...novo.payload },
    clientEventId: novo.clientEventId,
    desfazId,
    ...(novo.criadoEm ? { criadoEm: novo.criadoEm } : {}),
  }) as SumulaEvento
  return { ok: true, log: Object.freeze([...log, evento]), evento, duplicado: false }
}

/* ------------------------------- derivação -------------------------------- */

export interface PontoDerivado {
  seq: number
  equipe: Equipe
  origem: 'RALLY' | 'PENALIDADE' | 'FALTA_POSICAO' | 'FALTA_ROTACAO' | 'PAPELETA'
  cancelado: boolean
}

interface ContadoresEquipe {
  tempos: number
  substituicoesRegulares: number
  substituicoesExcepcionais: number
  /** Trocas de líbero NÃO entram na soma de substituições (RG-SET-008). */
  trocasLibero: number
  redesignacoes: number
  /** Sanções recebidas pela equipe no set (qualquer categoria; entre sets conta no set seguinte). */
  sancoes: number
}

export interface SetDerivado {
  numero: number
  alvo: number
  decisivo: boolean
  pontos: PontoDerivado[]
  placar: PlacarSet
  encerrado: boolean
  vencedor: Equipe | null
  /** RG-SET-006: a líder atingiu o ponto de troca e ainda não houve TROCA_LADO. */
  trocaLadoPendente: boolean
  trocouLado: boolean
  formacaoInicialA: number[]
  formacaoInicialB: number[]
  contadores: { A: ContadoresEquipe; B: ContadoresEquipe }
  sacouPrimeiro: Equipe
  /** Placar imposto por equipe incompleta (RG-WO-005). */
  ajusteIncompleta: PlacarSet | null
  /** seq do SET_INICIADO (pontos com este seq são penalidades lançadas no 0x0). */
  inicioSeq: number
  /** Rallies repetidos no set (RG-INT-001/002): não dão ponto, não mudam o sacador nem contam como rally concluído. */
  rallysRepetidos: number
  /** Passos que mexem no rodízio, em ordem (pontos e trocas), para o replay (RG-ROT-001/002). */
  jornal: JornalPasso[]
}

export type JornalPasso =
  | { tipo: 'PONTO'; ponto: PontoDerivado }
  | { tipo: 'TROCA'; equipe: Equipe; sai: number; entra: number }

/** Trocas de um pedido de substituição (uma, ou várias em `trocas`, RG-SUB-007). */
export function trocasDoPayload(p: PayloadPorTipo['SUBSTITUICAO']): Array<{ sai: number; entra: number }> {
  if (p.trocas && p.trocas.length > 0) return p.trocas.map((t) => ({ sai: t.sai, entra: t.entra }))
  return p.sai !== undefined && p.entra !== undefined ? [{ sai: p.sai, entra: p.entra }] : []
}

export type StatusPartida = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'WO' | 'A_REPETIR'

export interface InconsistenciaDerivacao {
  seq: number
  codigo: CodigoRegra
  mensagem: string
}

/** Relação nominal de cada equipe (ids de jogador, líberos inclusos). Vem do servidor, nunca do cliente. */
export interface ContextoDerivacao {
  elenco: { A: readonly number[]; B: readonly number[] }
  /** Capitão de cada equipe (RG-ELE-005). Opcional: sem ele, só a designação em quadra vale. */
  capitao?: { A?: number | null; B?: number | null }
  /** Horário previsto do jogo (ISO), para a tolerância de WO (RG-WO-002). */
  horarioPrevisto?: string
}

/** Estado completo das duas equipes no set corrente, mais o histórico de sanções da partida. */
export interface EstadosDerivados {
  A: EstadoEquipe
  B: EstadoEquipe
  sancoes: SancaoRegistrada[]
}

/** Jogadores que não podem atuar agora: expulsos no set, desqualificados, lesionados sem retorno e líberos incapazes. */
export function jogadoresImpedidos(estado: EstadoEquipe): number[] {
  return estado.elenco.filter((j) => jogadorImpedido(estado, j))
}

export interface PlacarDerivado {
  status: StatusPartida
  sets: SetDerivado[]
  setsAnulados: SetDerivado[]
  setAtual: SetDerivado | null
  setsGanhos: { a: number; b: number }
  saca: Equipe | null
  formacaoA: number[]
  formacaoB: number[]
  vencedor: Equipe | null
  wo: ResultadoWO | null
  observacoes: Array<{ seq: number; texto: string }>
  /** Eventos que o motor ignorou por violarem uma regra (nunca deveriam estar no log). */
  inconsistencias: InconsistenciaDerivacao[]
  /** Pontos cancelados por falta de rotação (para a "súmula anexa"). */
  houveCancelamentoDePontos: boolean
  /** Discrepâncias de papeleta registradas (RG-FOR-007/008/009). */
  discrepanciasPapeleta: DiscrepanciaPapeletaDerivada[]
  /** Pedidos indevidos registrados (RG-TMP-005) com a consequência classificada. */
  pedidosIndevidos: PedidoIndevidoDerivado[]
  /** Pedidos regulares da interrupção corrente por equipe (RG-TMP-003) e bloqueio por atraso (RG-TMP-006). */
  pedidosNaInterrupcao: { A: PedidosNaInterrupcao; B: PedidosNaInterrupcao }
  /** Capitão em jogo de cada equipe agora (RG-ELE-005); null = falta designar ou fora de set. */
  capitaesEmJogo: { A: number | null; B: number | null }
  /** Protestos anunciados, registrados e desistidos (RG-PRO-001..003). Sem decisão de mérito. */
  protestos: ProtestoDerivado[]
  ultimoSeq: number
  /** Só vem preenchido quando `derivarPlacar` recebe o contexto (relação nominal) e já houve um set. */
  estadoEquipes: EstadosDerivados | null
}

function contadoresVazios(): ContadoresEquipe {
  return {
    tempos: 0,
    substituicoesRegulares: 0,
    substituicoesExcepcionais: 0,
    trocasLibero: 0,
    redesignacoes: 0,
    sancoes: 0,
  }
}

function recalcular(set: SetDerivado, config: ConfigPartida): void {
  let a = 0
  let b = 0
  for (const p of set.pontos) {
    if (p.cancelado) continue
    if (p.equipe === 'A') a += 1
    else b += 1
  }
  set.placar = { a, b }
  if (set.ajusteIncompleta) {
    set.placar = set.ajusteIncompleta
    set.encerrado = true
    set.vencedor = set.placar.a > set.placar.b ? 'A' : 'B'
    return
  }
  set.encerrado = setEncerrado(set.placar, set.alvo, config.margem)
  set.vencedor = set.encerrado ? (set.placar.a > set.placar.b ? 'A' : 'B') : null
  set.trocaLadoPendente =
    !set.trocouLado &&
    deveTrocarDeLado(config, { decisivo: set.decisivo, placar: set.placar, jaTrocou: set.trocouLado })
}

function trocarNaFormacao(formacao: number[], sai: number, entra: number): number[] {
  return formacao.map((j) => (j === sai ? entra : j))
}

export function derivarPlacar(
  log: readonly SumulaEvento[],
  config: ConfigPartida,
  contexto?: ContextoDerivacao,
): PlacarDerivado {
  const efetivos = eventosEfetivos(log)
  const sets: SetDerivado[] = []
  const setsAnulados: SetDerivado[] = []
  const observacoes: PlacarDerivado['observacoes'] = []
  const inconsistencias: InconsistenciaDerivacao[] = []
  const st: { saque: { formacaoA: number[]; formacaoB: number[]; saca: Equipe } | null } = { saque: null }
  let wo: ResultadoWO | null = null
  let aRepetir = false
  let vencedorForcado: Equipe | null = null
  let houveCancelamento = false
  const pontosPendentes: Equipe[] = [] // penalidades entre sets, lançadas no 0x0 do próximo set

  const atual = (): SetDerivado | null => sets[sets.length - 1] ?? null
  const rejeitar = (seq: number, codigo: CodigoRegra, mensagem: string) => inconsistencias.push({ seq, codigo, mensagem })

  // Estado completo das equipes (só com o contexto da relação nominal).
  let eq: EstadosDerivados | null = null
  const historicoSancoes: SancaoRegistrada[] = []
  let minutosInterrompidos = 0
  const sincronizarQuadra = () => {
    if (!eq || !st.saque) return
    eq.A = { ...eq.A, emQuadra: [...st.saque.formacaoA] }
    eq.B = { ...eq.B, emQuadra: [...st.saque.formacaoB] }
  }
  const idDoMembro = (membro: string): number | null => (membro.startsWith('J:') ? Number(membro.slice(2)) : null)

  // RG-TMP-003/005/006: pedidos da interrupção corrente e pedidos indevidos da partida.
  const interrupcao: { A: PedidosNaInterrupcao; B: PedidosNaInterrupcao } = { A: interrupcaoVazia(), B: interrupcaoVazia() }
  const pedidosIndevidos: PedidoIndevidoDerivado[] = []
  const indevidosSemAtraso = { A: 0, B: 0 }

  const concedePonto = (set: SetDerivado, seq: number, equipe: Equipe, origem: PontoDerivado['origem']) => {
    // Rally concluído: a interrupção acaba e o bloqueio por atraso (RG-TMP-006) cai. Penalidade não é rally.
    if (origem !== 'PENALIDADE') {
      interrupcao.A = interrupcaoVazia()
      interrupcao.B = interrupcaoVazia()
    }
    // O ponto de penalidade é administrativo: não houve rally, então não libera outra troca de líbero
    // (RG-LIB-005) nem um novo pedido de substituição.
    if (eq && origem !== 'PENALIDADE') {
      eq.A = registrarRallyConcluido(eq.A)
      eq.B = registrarRallyConcluido(eq.B)
    }
    const novoPonto: PontoDerivado = { seq, equipe, origem, cancelado: false }
    set.pontos.push(novoPonto)
    set.jornal.push({ tipo: 'PONTO', ponto: novoPonto })
    if (st.saque) {
      const prox = aplicarRally(st.saque, equipe)
      st.saque = { saca: prox.saca, formacaoA: [...prox.formacaoA], formacaoB: [...prox.formacaoB] }
    }
    recalcular(set, config)
  }

  /**
   * Reversão por falta de rotação / papeleta (RG-ROT-001/002, RG-FOR-008/009): cancela os pontos da faltosa,
   * RECALCULA o rodízio por replay dos pontos vivos e dá ponto e saque ao adversário.
   * `formacaoCorrigida` (informada pelo árbitro) prevalece sobre o replay para a equipe faltosa.
   */
  const reverterEPontuar = (
    set: SetDerivado,
    seq: number,
    equipeFaltosa: Equipe,
    momentoSeq: number | null,
    pontoDoRallyDaFaltaSeq: number | null,
    formacaoCorrigida: number[] | undefined,
    origem: PontoDerivado['origem'],
  ) => {
    const vivos: PontoLog[] = set.pontos.filter((x) => !x.cancelado).map((x) => ({ seq: x.seq, equipe: x.equipe }))
    const reversao = calcularReversaoFaltaRotacao(vivos, { equipeFaltosa, momentoSeq, pontoDoRallyDaFaltaSeq })
    for (const ponto of set.pontos) if (reversao.cancelados.includes(ponto.seq)) ponto.cancelado = true
    if (reversao.cancelados.length > 0) houveCancelamento = true
    // O set pode ter sido reaberto pela reversão: o ponto do adversário entra normalmente.
    set.encerrado = false
    const passos: PassoReplay[] = set.jornal.map((j) =>
      j.tipo === 'PONTO' ? { tipo: 'PONTO', equipe: j.ponto.equipe, cancelado: j.ponto.cancelado } : j,
    )
    const refeito = reconstruirRodizio(
      { formacaoA: set.formacaoInicialA, formacaoB: set.formacaoInicialB, saca: set.sacouPrimeiro },
      passos,
    )
    st.saque = { saca: refeito.saca, formacaoA: [...refeito.formacaoA], formacaoB: [...refeito.formacaoB] }
    if (formacaoCorrigida) {
      st.saque = {
        ...st.saque,
        ...(equipeFaltosa === 'A' ? { formacaoA: [...formacaoCorrigida] } : { formacaoB: [...formacaoCorrigida] }),
      }
    }
    concedePonto(set, seq, outraEquipe(equipeFaltosa), origem)
  }

  const sancoesPendentes: Equipe[] = [] // sanções entre sets: contam no set seguinte
  const discrepancias: DiscrepanciaPapeletaDerivada[] = []
  const protestos: ProtestoDerivado[] = []
  const designados: { A: number | null; B: number | null } = { A: null, B: null }
  let capitaes: { A: number | null; B: number | null } = { A: null, B: null }

  /** RG-ELE-005: o capitão em jogo muda com as substituições; a designação cai quando o designado sai. */
  const atualizarCapitaes = () => {
    if (!st.saque) {
      capitaes = { A: null, B: null }
      return
    }
    const quadra = { A: st.saque.formacaoA, B: st.saque.formacaoB }
    for (const q of ['A', 'B'] as const) {
      if (designados[q] !== null && !quadra[q].includes(designados[q]!)) designados[q] = null
      capitaes[q] = capitaoEmJogo({ capitao: contexto?.capitao?.[q], designado: designados[q], emQuadra: quadra[q] })
    }
  }

  const partidaTerminou = (): boolean => {
    if (wo || aRepetir || vencedorForcado) return true
    const g = contarGanhos(sets)
    return sets.length > 0 && partidaEncerrada(g.a, g.b, config)
  }

  /** RG-PRO-001..003: protestos viram eventos; o motor registra e NÃO decide o mérito (RG-PRO-004). */
  const tratarProtesto = (e: Extract<SumulaEvento, { tipo: 'PROTESTO_ANUNCIADO' | 'PROTESTO_REGISTRADO' | 'PROTESTO_DESISTIDO' }>) => {
    const equipe = e.payload.equipe
    const aberto = protestos.find((x) => x.equipe === equipe && x.estado === 'ANUNCIADO')
    if (e.tipo === 'PROTESTO_ANUNCIADO') {
      if (partidaTerminou() || sets.length === 0) {
        rejeitar(e.seq, 'RG-PRO-001', 'O protesto é anunciado na hora, com a partida em andamento; depois do fim só se registra ou se desiste.')
        return
      }
      const jogador = e.payload.jogador
      if (jogador !== undefined && capitaes[equipe] !== null && jogador !== capitaes[equipe]) {
        rejeitar(e.seq, 'RG-PRO-001', `Só o capitão em jogo (${capitaes[equipe]}) pode anunciar o protesto; o jogador ${jogador} não é.`)
        return
      }
      if (aberto) {
        rejeitar(e.seq, 'RG-PRO-001', `A equipe ${equipe} já tem um protesto anunciado em aberto.`)
        return
      }
      protestos.push({ seq: e.seq, equipe, estado: 'ANUNCIADO', relato: null, anunciadoEm: e.seq, resolvidoEm: null })
      return
    }
    if (!partidaTerminou()) {
      rejeitar(e.seq, e.tipo === 'PROTESTO_REGISTRADO' ? 'RG-PRO-002' : 'RG-PRO-003', 'O protesto é registrado (ou abandonado) só ao fim da partida.')
      return
    }
    if (e.tipo === 'PROTESTO_DESISTIDO') {
      if (!aberto) {
        rejeitar(e.seq, 'RG-PRO-003', `Não há protesto anunciado pela equipe ${equipe} para desistir.`)
        return
      }
      aberto.estado = 'DESISTIDO'
      aberto.resolvidoEm = e.seq
      return
    }
    if (!e.payload.relato || e.payload.relato.trim() === '') {
      rejeitar(e.seq, 'RG-PRO-002', 'O protesto registrado precisa do relato.')
      return
    }
    if (!aberto) {
      if (config.protestoExigeAnuncio !== false) {
        rejeitar(e.seq, 'RG-PRO-002', `A equipe ${equipe} não anunciou o protesto na hora; ele não pode ser registrado ao fim.`)
        return
      }
      protestos.push({ seq: e.seq, equipe, estado: 'REGISTRADO', relato: e.payload.relato, anunciadoEm: null, resolvidoEm: e.seq })
      return
    }
    aberto.estado = 'REGISTRADO'
    aberto.relato = e.payload.relato
    aberto.resolvidoEm = e.seq
  }

  for (const e of efetivos) {
    if (wo || aRepetir) {
      // Observação continua valendo depois do fim (ex.: justificativa do WO).
      if (e.tipo === 'OBSERVACAO') {
        observacoes.push({ seq: e.seq, texto: e.payload.texto })
        continue
      }
      if (e.tipo === 'PROTESTO_REGISTRADO' || e.tipo === 'PROTESTO_DESISTIDO') {
        tratarProtesto(e)
        continue
      }
      rejeitar(e.seq, 'RG-WO-001', 'Evento após o encerramento por WO/repetição da partida foi ignorado.')
      continue
    }
    switch (e.tipo) {
      case 'SET_INICIADO': {
        const p = e.payload
        const anterior = atual()
        if (anterior && !anterior.encerrado && p.numeroSet === anterior.numero) {
          rejeitar(
            e.seq,
            'RG-FOR-006',
            `A papeleta do ${anterior.numero}º set já foi entregue e não muda; para trocar um jogador use a substituição regular.`,
          )
          break
        }
        if (anterior && !anterior.encerrado) {
          rejeitar(e.seq, 'RG-SET-001', `O ${anterior.numero}º set ainda não terminou; não é possível iniciar outro.`)
          break
        }
        const ganhos = contarGanhos(sets)
        if (partidaEncerrada(ganhos.a, ganhos.b, config)) {
          rejeitar(e.seq, 'RG-SET-004', 'A partida já terminou; não existe novo set.')
          break
        }
        if (p.numeroSet !== sets.length + 1) {
          rejeitar(e.seq, 'RG-SET-004', `Número de set inesperado: esperado ${sets.length + 1}, recebido ${p.numeroSet}.`)
          break
        }
        const set: SetDerivado = {
          numero: p.numeroSet,
          alvo: alvoDoSet(config, p.numeroSet),
          decisivo: ehSetDecisivo(config, ganhos.a, ganhos.b),
          pontos: [],
          placar: { a: 0, b: 0 },
          encerrado: false,
          vencedor: null,
          trocaLadoPendente: false,
          trocouLado: false,
          formacaoInicialA: [...p.formacaoA],
          formacaoInicialB: [...p.formacaoB],
          contadores: { A: contadoresVazios(), B: contadoresVazios() },
          sacouPrimeiro: p.saqueInicial,
          ajusteIncompleta: null,
          inicioSeq: e.seq,
          rallysRepetidos: 0,
          jornal: [],
        }
        for (const eqp of sancoesPendentes.splice(0)) set.contadores[eqp].sancoes += 1
        designados.A = null
        designados.B = null
        interrupcao.A = interrupcaoVazia()
        interrupcao.B = interrupcaoVazia()
        sets.push(set)
        st.saque = { formacaoA: [...p.formacaoA], formacaoB: [...p.formacaoB], saca: p.saqueInicial }
        if (contexto) {
                    const novo = (equipe: Equipe, formacao: number[], liberos: number[] | undefined): EstadoEquipe => {
            const elenco = [...contexto.elenco[equipe]]
            const base = eq
              ? iniciarNovoSet(eq[equipe], formacao)
              : criarEstadoEquipe({ elenco, liberos: (liberos ?? []).filter((l) => elenco.includes(l)), formacaoInicial: formacao })
            // Expulsão aplicada entre sets vale no set que começa agora (RG-SAN-010).
            const expulsos = historicoSancoes
              .filter((s) => s.equipe === equipe && s.sancao === 'EXPULSAO' && s.set === p.numeroSet)
              .map((s) => idDoMembro(s.membro))
              .filter((j): j is number => j !== null)
            return { ...base, expulsosNoSet: expulsos }
          }
          eq = { A: novo('A', p.formacaoA, p.liberosA), B: novo('B', p.formacaoB, p.liberosB), sancoes: historicoSancoes }
        }
        for (const equipePunida of pontosPendentes.splice(0)) {
          concedePonto(set, e.seq, outraEquipe(equipePunida), 'PENALIDADE')
        }
        break
      }
      case 'PONTO': {
        const set = atual()
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, 'RG-SET-001', 'Ponto lançado sem set em andamento.')
          break
        }
        // Ordem de saque e saque de líbero são conferidos na derivação também: o servidor não confia no cliente.
        if (e.payload.sacador !== undefined) {
          const ordem = validarSacador(st.saque, e.payload.sacador)
          if (!ordem.ok) rejeitar(e.seq, ordem.codigo, ordem.mensagem)
        }
        if (eq) {
          const saqueLibero = validarSaqueDoLibero(eq[st.saque.saca])
          if (!saqueLibero.ok) rejeitar(e.seq, saqueLibero.codigo, saqueLibero.mensagem)
        }
        concedePonto(set, e.seq, e.payload.equipe, 'RALLY')
        break
      }
      case 'FALTA_POSICAO': {
        const set = atual()
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, 'RG-POS-003', 'Falta de posição sem set em andamento.')
          break
        }
        concedePonto(set, e.seq, outraEquipe(e.payload.equipeFaltosa), 'FALTA_POSICAO')
        break
      }
      case 'SANCAO': {
        const set = atual()
        const p = e.payload
        // O servidor é a autoridade: a sanção e o ponto são recalculados a partir do histórico da partida.
        const pedido = {
          equipe: p.equipe,
          membro: p.membro,
          categoria: p.categoria as CategoriaSancao,
          set: set?.numero ?? 1,
          entreSets: p.entreSets === true,
        }
        const avaliada = avaliarSancao(historicoSancoes, pedido)
        if (!avaliada.ok) {
          rejeitar(e.seq, avaliada.codigo, avaliada.mensagem)
          break
        }
        if (avaliada.sancao !== p.sancao || avaliada.pontoParaAdversario !== p.pontoParaAdversario) {
          rejeitar(
            e.seq,
            avaliada.codigo,
            `A sanção gravada (${p.sancao}) não confere com a calculada (${avaliada.sancao}); vale a calculada.`,
          )
        }
        historicoSancoes.push(registrarSancao(pedido, avaliada))
        if (p.entreSets || !set || set.encerrado) sancoesPendentes.push(p.equipe)
        else set.contadores[p.equipe].sancoes += 1
        if (eq) {
          const jogador = idDoMembro(p.membro)
          if (jogador !== null && avaliada.sancao === 'EXPULSAO' && !p.entreSets && !eq[p.equipe].expulsosNoSet.includes(jogador)) {
            eq[p.equipe] = { ...eq[p.equipe], expulsosNoSet: [...eq[p.equipe].expulsosNoSet, jogador] }
          }
          if (jogador !== null && avaliada.sancao === 'DESQUALIFICACAO' && !eq[p.equipe].desqualificados.includes(jogador)) {
            eq[p.equipe] = { ...eq[p.equipe], desqualificados: [...eq[p.equipe].desqualificados, jogador] }
          }
        }
        if (avaliada.pontoParaAdversario) {
          if (p.entreSets || !set || set.encerrado || !st.saque) pontosPendentes.push(p.equipe)
          else concedePonto(set, e.seq, outraEquipe(p.equipe), 'PENALIDADE')
        }
        break
      }
      case 'FALTA_ROTACAO': {
        const set = atual()
        if (!set || !st.saque) {
          rejeitar(e.seq, 'RG-ROT-002', 'Falta de rotação sem set em andamento.')
          break
        }
        const p = e.payload
        reverterEPontuar(set, e.seq, p.equipeFaltosa, p.momentoSeq, p.pontoDoRallyDaFaltaSeq ?? null, p.formacaoCorrigida, 'FALTA_ROTACAO')
        break
      }
      case 'SUBSTITUICAO': {
        const set = atual()
        if (!set || !st.saque) {
          rejeitar(e.seq, 'RG-SUB-006', 'Substituição sem set em andamento.')
          break
        }
        const p = e.payload
        const trocas = trocasDoPayload(p)
        if (trocas.length === 0) {
          rejeitar(e.seq, 'RG-SUB-007', 'Substituição sem jogadores (informe sai/entra ou trocas).')
          break
        }
        for (const t of trocas) {
          if (p.equipe === 'A') st.saque = { ...st.saque, formacaoA: trocarNaFormacao(st.saque.formacaoA, t.sai, t.entra) }
          else st.saque = { ...st.saque, formacaoB: trocarNaFormacao(st.saque.formacaoB, t.sai, t.entra) }
          set.jornal.push({ tipo: 'TROCA', equipe: p.equipe, sai: t.sai, entra: t.entra })
        }
        // RG-TMP-006: bloqueio por advertência de atraso (vale para pedido regular). RG-TMP-003: sem contexto da relação
        // nominal a sequência de pedidos é conferida aqui; com contexto, quem confere é RG-SUB-007 (estado da equipe).
        if (!p.excepcional) {
          const naSequencia = validarPedidoNaInterrupcao(interrupcao[p.equipe], { tipo: 'SUBSTITUICAO' })
          if (!naSequencia.ok && (naSequencia.codigo === 'RG-TMP-006' || !eq)) rejeitar(e.seq, naSequencia.codigo, naSequencia.mensagem)
          interrupcao[p.equipe] = registrarPedidoNaInterrupcao(interrupcao[p.equipe], 'SUBSTITUICAO')
        }
        // Contagem por jogador que entra: cada troca do pedido conta 1 (RG-SUB-007).
        const c = set.contadores[p.equipe]
        if (p.excepcional) c.substituicoesExcepcionais += trocas.length
        else c.substituicoesRegulares += trocas.length
        if (eq) {
          const r = p.excepcional
            ? aplicarSubstituicaoExcepcional(eq[p.equipe], { ...trocas[0]!, motivo: p.motivo as MotivoExcepcional }, config.perfil)
            : aplicarSubstituicaoLote(eq[p.equipe], trocas, config.perfil)
          if (r.resultado.ok) eq[p.equipe] = r.estado
          else rejeitar(e.seq, r.resultado.codigo, r.resultado.mensagem)
        }
        break
      }
      case 'TROCA_LIBERO': {
        const set = atual()
        if (!set || !st.saque) {
          rejeitar(e.seq, 'RG-LIB-005', 'Troca de líbero sem set em andamento.')
          break
        }
        const p = e.payload
        if (p.equipe === 'A') st.saque = { ...st.saque, formacaoA: trocarNaFormacao(st.saque.formacaoA, p.sai, p.entra) }
        else st.saque = { ...st.saque, formacaoB: trocarNaFormacao(st.saque.formacaoB, p.sai, p.entra) }
        set.jornal.push({ tipo: 'TROCA', equipe: p.equipe, sai: p.sai, entra: p.entra })
        set.contadores[p.equipe].trocasLibero += 1
        if (eq) {
          const r = aplicarTrocaLibero(eq[p.equipe], { sai: p.sai, entra: p.entra }, { momento: p.momento ?? 'BOLA_FORA' })
          if (r.resultado.ok) eq[p.equipe] = r.estado
          else rejeitar(e.seq, r.resultado.codigo, r.resultado.mensagem)
        }
        break
      }
      case 'REDESIGNACAO_LIBERO': {
        const set = atual()
        if (!set || !st.saque) break
        const p = e.payload
        if (p.equipe === 'A') st.saque = { ...st.saque, formacaoA: trocarNaFormacao(st.saque.formacaoA, p.liberoIncapaz, p.novoLibero) }
        else st.saque = { ...st.saque, formacaoB: trocarNaFormacao(st.saque.formacaoB, p.liberoIncapaz, p.novoLibero) }
        set.jornal.push({ tipo: 'TROCA', equipe: p.equipe, sai: p.liberoIncapaz, entra: p.novoLibero })
        set.contadores[p.equipe].redesignacoes += 1
        if (eq) {
          const pontosEquipe = p.equipe === 'A' ? set.placar.a : set.placar.b
          const r = aplicarRedesignacaoLibero(
            eq[p.equipe],
            { liberoIncapaz: p.liberoIncapaz, novoLibero: p.novoLibero, motivo: 'INCAPAZ' },
            {
              equipe: p.equipe,
              numeroSet: set.numero,
              pontosEquipe,
              pontosAdversario: p.equipe === 'A' ? set.placar.b : set.placar.a,
            },
          )
          if (r.resultado.ok) eq[p.equipe] = r.estado
          else rejeitar(e.seq, r.resultado.codigo, r.resultado.mensagem)
        }
        break
      }
      case 'TEMPO': {
        const set = atual()
        if (!set) {
          rejeitar(e.seq, 'RG-TMP-001', 'Tempo pedido sem set em andamento.')
          break
        }
        const limiteTempo = validarPedidoDeTempo({
          temposUsados: set.contadores[e.payload.equipe].tempos,
          limite: config.perfil.temposPorSet,
          bolaForaDeJogo: true,
          antesDoApito: true,
        })
        if (!limiteTempo.ok) {
          rejeitar(e.seq, limiteTempo.codigo, limiteTempo.mensagem)
        } else {
          // RG-TMP-003 / RG-TMP-006: tempos seguidos na interrupção e bloqueio por advertência de atraso.
          const naSequencia = validarPedidoNaInterrupcao(interrupcao[e.payload.equipe], { tipo: 'TEMPO' })
          if (!naSequencia.ok) rejeitar(e.seq, naSequencia.codigo, naSequencia.mensagem)
        }
        interrupcao[e.payload.equipe] = registrarPedidoNaInterrupcao(interrupcao[e.payload.equipe], 'TEMPO')
        set.contadores[e.payload.equipe].tempos += 1
        break
      }
      case 'PEDIDO_INDEVIDO': {
        const set = atual()
        const p = e.payload
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, 'RG-TMP-005', 'Pedido indevido registrado sem set em andamento.')
          break
        }
        const atrasosAnteriores = historicoSancoes.filter((s) => s.equipe === p.equipe && s.categoria === 'ATRASO').length
        const c = classificarPedidoIndevido({
          indevidosAnterioresSemAtraso: indevidosSemAtraso[p.equipe],
          atrasosAnteriores,
          atrasaOJogo: p.atrasaOJogo === true,
        })
        if (c.consequencia === 'REGISTRO_SEM_SANCAO') indevidosSemAtraso[p.equipe] += 1
        if (c.bloqueiaNovosPedidos) interrupcao[p.equipe] = { ...interrupcao[p.equipe], bloqueada: true }
        pedidosIndevidos.push({ seq: e.seq, equipe: p.equipe, tipo: p.tipo ?? 'OUTRO', consequencia: c.consequencia, sancaoSugerida: c.sancaoSugerida })
        break
      }
      case 'TROCA_LADO': {
        const set = atual()
        if (set) {
          set.trocouLado = true
          set.trocaLadoPendente = false
        }
        break
      }
      case 'SET_ANULADO': {
        const set = atual()
        if (!set) {
          rejeitar(e.seq, 'RG-INT-004', 'Não há set para anular.')
          break
        }
        sets.pop()
        setsAnulados.push(set)
        st.saque = null
        break
      }
      case 'INTERRUPCAO': {
        observacoes.push({
          seq: e.seq,
          texto: `INTERRUPÇÃO DE ${e.payload.minutos} MINUTOS: ${e.payload.motivo.toUpperCase()}`,
        })
        minutosInterrompidos += e.payload.minutos
        // O servidor decide pela soma das paralisações (RG-INT-005); a ação do cliente só confirma.
        const decisao = decidirInterrupcao({
          minutosTotaisDeParalisacao: minutosInterrompidos,
          voltaNaMesmaQuadra: e.payload.acao === 'CONTINUAR_SET',
        })
        if (decisao.acao === 'REPETIR_PARTIDA') aRepetir = true
        if ((e.payload.acao === 'REPETIR_PARTIDA') !== (decisao.acao === 'REPETIR_PARTIDA')) {
          if (e.payload.acao === 'REPETIR_PARTIDA') {
            rejeitar(e.seq, 'RG-INT-005', `Repetir a partida só vale quando as paralisações passam de 4 horas (somam ${minutosInterrompidos} minutos).`)
          } else {
            rejeitar(e.seq, decisao.codigo, decisao.mensagem)
          }
        }
        break
      }
      case 'WO': {
        const ganhosAteAqui = contarGanhos(sets)
        if (sets.length > 0 && partidaEncerrada(ganhosAteAqui.a, ganhosAteAqui.b, config)) {
          rejeitar(e.seq, 'RG-WO-001', 'A partida já terminou: não cabe WO depois do último set.')
          break
        }
        const emAndamento = atual()
        wo = resolverWO(config, {
          ausente: e.payload.ausente,
          setsJogados: sets.filter((s) => s.encerrado).map((s) => s.placar),
          setInterrompido: emAndamento && !emAndamento.encerrado ? { numero: emAndamento.numero, placar: { ...emAndamento.placar } } : null,
        })
        break
      }
      case 'EQUIPE_INCOMPLETA': {
        const set = atual()
        if (!set || set.encerrado) {
          rejeitar(e.seq, 'RG-WO-005', 'Equipe incompleta declarada sem set em andamento.')
          break
        }
        const r = resolverEquipeIncompleta(config, {
          equipeIncompleta: e.payload.equipe,
          escopo: e.payload.escopo,
          numeroSet: set.numero,
          placarAtual: set.placar,
          setsJogados: sets.filter((s) => s !== set && s.encerrado).map((s) => s.placar),
        })
        set.ajusteIncompleta = r.placarSetAjustado
        recalcular(set, config)
        if (r.vencedorDaPartida) vencedorForcado = r.vencedorDaPartida
        break
      }
      case 'OBSERVACAO': {
        observacoes.push({ seq: e.seq, texto: e.payload.texto })
        break
      }
      case 'RALLY_REPETIDO': {
        // RG-INT-001/002: o rally é repetido SEM ponto, o mesmo sacador volta a sacar e nada gira.
        // Também não vale como rally concluído (não libera outro pedido de substituição nem nova troca de líbero).
        const set = atual()
        const codigo = e.payload.motivo === 'FALTA_DUPLA' ? 'RG-PTO-002' : e.payload.motivo === 'INTERFERENCIA_EXTERNA' ? 'RG-INT-002' : 'RG-INT-001'
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, codigo, 'O rally só é repetido com um set em andamento.')
          break
        }
        set.rallysRepetidos += 1
        break
      }
      case 'DISCREPANCIA_PAPELETA': {
        const set = atual()
        const p = e.payload
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, 'RG-FOR-007', 'Discrepância de papeleta sem set em andamento.')
          break
        }
        const jogoIniciado = set.pontos.some((x) => x.seq !== set.inicioSeq)
        const efeito = consequenciaDeDiscrepancia(p.fase, p.causa)
        if (p.fase === 'ANTES_DO_SET' && jogoIniciado) {
          rejeitar(e.seq, 'RG-FOR-008', 'O set já começou: a discrepância é tratada como descoberta depois do início (fase DEPOIS_DO_INICIO).')
          break
        }
        if (p.fase === 'DEPOIS_DO_INICIO' && !jogoIniciado) {
          rejeitar(e.seq, 'RG-FOR-007', 'O set ainda não começou: use a fase ANTES_DO_SET (sem sanção nem ponto).')
          break
        }
        if (contexto && p.causa === 'JOGADOR_NAO_REGISTRADO' && p.jogador !== undefined && contexto.elenco[p.equipe].includes(p.jogador)) {
          rejeitar(e.seq, 'RG-FOR-009', `O jogador ${p.jogador} consta na relação nominal; não é jogador não registrado.`)
          break
        }
        // RG-FOR-009 completo: o não registrado entrou em set ANTERIOR; os sets desde a entrada são reabertos.
        const retroativo = p.setEntrada !== undefined && p.setEntrada !== set.numero
        if (retroativo) {
          if (p.causa !== 'JOGADOR_NAO_REGISTRADO' || p.fase !== 'DEPOIS_DO_INICIO') {
            rejeitar(e.seq, 'RG-FOR-009', 'O set de entrada só se informa para jogador não registrado descoberto depois do início do set.')
            break
          }
          if (p.setEntrada! > set.numero || p.setEntrada! < 1) {
            rejeitar(e.seq, 'RG-FOR-009', `O ${p.setEntrada}º set não é anterior ao set corrente (${set.numero}º).`)
            break
          }
          const perda = calcularPerdaPorNaoRegistrado({
            faltosa: p.equipe,
            setEntrada: p.setEntrada!,
            momentoSeq: p.momentoSeq ?? null,
            setsAnteriores: sets
              .filter((x) => x !== set && x.encerrado)
              .map((x) => ({
                numero: x.numero,
                alvo: x.alvo,
                encerrado: x.encerrado,
                vencedor: x.vencedor,
                placar: { ...x.placar },
                pontos: x.pontos.map((pt) => ({ seq: pt.seq, equipe: pt.equipe, cancelado: pt.cancelado })),
              })),
            opcoes: { margem: config.margem, zerarSetsJaPerdidos: config.naoRegistradoZeraSetsJaPerdidos === true },
          })
          if (!perda.ok) {
            rejeitar(e.seq, perda.codigo, perda.mensagem)
            break
          }
          for (const pd of perda.perdas) {
            const alvoSet = sets.find((x) => x.numero === pd.numero)
            if (!alvoSet) continue
            for (const pt of alvoSet.pontos) if (pd.cancelados.includes(pt.seq)) pt.cancelado = true
            if (pd.cancelados.length > 0) houveCancelamento = true
            if (pd.sobrescreve) alvoSet.ajusteIncompleta = pd.placar
            recalcular(alvoSet, config)
          }
          observacoes.push({
            seq: e.seq,
            texto: `JOGADOR NÃO REGISTRADO (EQUIPE ${p.equipe}) DESDE O ${p.setEntrada}º SET: ${perda.perdas
              .map((pd) => `${pd.numero}º SET ${pd.placarOriginal.a}X${pd.placarOriginal.b} PASSA A ${pd.placar.a}X${pd.placar.b}`)
              .join('; ')}`,
          })
        }
        discrepancias.push({ seq: e.seq, equipe: p.equipe, fase: p.fase, causa: p.causa, codigo: efeito.codigo, jogador: p.jogador ?? null })
        if (p.fase === 'DEPOIS_DO_INICIO') {
          // Retroativo: o jogador está em quadra desde o início do set corrente, então todos os pontos da faltosa nele caem.
          reverterEPontuar(set, e.seq, p.equipe, retroativo ? set.inicioSeq : (p.momentoSeq ?? null), p.pontoDoRallyDaFaltaSeq ?? null, p.formacaoCorrigida, 'PAPELETA')
        } else if (p.formacaoCorrigida) {
          // Antes do set: as posições voltam à papeleta; a correção só confirma a formação já entregue.
          const entregue = p.equipe === 'A' ? set.formacaoInicialA : set.formacaoInicialB
          if (p.formacaoCorrigida.some((j, i) => j !== entregue[i])) {
            rejeitar(e.seq, 'RG-FOR-006', 'Antes do set a formação volta à papeleta entregue; para mudar um jogador faça uma substituição regular.')
          }
        }
        break
      }
      case 'CAPITAO_EM_JOGO': {
        const set = atual()
        if (!set || set.encerrado || !st.saque) {
          rejeitar(e.seq, 'RG-ELE-005', 'O capitão em jogo é designado com um set em andamento.')
          break
        }
        const q = e.payload.equipe
        const r = validarDesignacaoDeCapitao({
          capitao: contexto?.capitao?.[q],
          designado: e.payload.jogador,
          emQuadra: q === 'A' ? st.saque.formacaoA : st.saque.formacaoB,
          ...(contexto ? { elenco: contexto.elenco[q] } : {}),
          ...(eq ? { impedidos: jogadoresImpedidos(eq[q]) } : {}),
        })
        if (!r.ok) rejeitar(e.seq, r.codigo, r.mensagem)
        else designados[q] = e.payload.jogador
        break
      }
      case 'PROTESTO_ANUNCIADO':
      case 'PROTESTO_REGISTRADO':
      case 'PROTESTO_DESISTIDO':
        tratarProtesto(e)
        break
    }
    sincronizarQuadra()
    atualizarCapitaes()
  }

  const ganhos = contarGanhos(sets)
  const setAtual = atual()
  let status: StatusPartida
  let vencedor: Equipe | null = null
  if (wo) {
    status = 'WO'
    vencedor = (wo as ResultadoWO).vencedor
  } else if (aRepetir) {
    status = 'A_REPETIR'
  } else if (vencedorForcado) {
    status = 'ENCERRADA'
    vencedor = vencedorForcado
  } else if (sets.length > 0 && partidaEncerrada(ganhos.a, ganhos.b, config)) {
    status = 'ENCERRADA'
    vencedor = ganhos.a > ganhos.b ? 'A' : 'B'
  } else if (sets.length > 0) {
    status = 'EM_ANDAMENTO'
  } else {
    status = 'NAO_INICIADA'
  }

  const s = st.saque
  return {
    status,
    sets,
    setsAnulados,
    setAtual,
    setsGanhos: ganhos,
    saca: s?.saca ?? null,
    formacaoA: s?.formacaoA ?? [],
    formacaoB: s?.formacaoB ?? [],
    vencedor,
    wo,
    observacoes,
    inconsistencias,
    houveCancelamentoDePontos: houveCancelamento,
    discrepanciasPapeleta: discrepancias,
    pedidosIndevidos,
    pedidosNaInterrupcao: interrupcao,
    capitaesEmJogo: capitaes,
    protestos,
    ultimoSeq: log.length > 0 ? log[log.length - 1]!.seq : 0,
    estadoEquipes: eq,
  }
}

function contarGanhos(sets: readonly SetDerivado[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const s of sets) {
    if (!s.encerrado) continue
    if (s.vencedor === 'A') a += 1
    else if (s.vencedor === 'B') b += 1
  }
  return { a, b }
}

/** Viagem no tempo: placar como estava até o evento `seq` (auditoria / "ver como estava"). */
export function derivarPlacarAte(log: readonly SumulaEvento[], config: ConfigPartida, seq: number): PlacarDerivado {
  return derivarPlacar(log.filter((e) => e.seq <= seq), config)
}
