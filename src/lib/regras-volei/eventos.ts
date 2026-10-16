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
import { aplicarTrocaLibero, aplicarRedesignacaoLibero, type MomentoDaTroca } from './libero'
import { aplicarRally, calcularReversaoFaltaRotacao, type PontoLog } from './rotacao'
import type { CategoriaSancao, SancaoRegistrada, TipoSancao } from './sancoes'
import { alvoDoSet, deveTrocarDeLado, ehSetDecisivo, partidaEncerrada, setEncerrado } from './set-partida'
import { aplicarSubstituicaoExcepcional, aplicarSubstituicaoRegular, type MotivoExcepcional } from './substituicoes'
import { resolverEquipeIncompleta, resolverWO, type ResultadoWO } from './wo-interrupcao'
import {
  bloqueio,
  outraEquipe,
  type CodigoRegra,
  type Equipe,
  type PlacarSet,
  type RegraBloqueio,
} from './tipos'
import type { AcaoInterrupcao } from './wo-interrupcao'

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
  RALLY_REPETIDO: Record<string, never>
  SUBSTITUICAO: { equipe: Equipe; sai: number; entra: number; excepcional?: boolean; motivo?: string }
  TEMPO: { equipe: Equipe }
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
  origem: 'RALLY' | 'PENALIDADE' | 'FALTA_POSICAO' | 'FALTA_ROTACAO'
  cancelado: boolean
}

interface ContadoresEquipe {
  tempos: number
  substituicoesRegulares: number
  substituicoesExcepcionais: number
  /** Trocas de líbero NÃO entram na soma de substituições (RG-SET-008). */
  trocasLibero: number
  redesignacoes: number
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
  ultimoSeq: number
  /** Só vem preenchido quando `derivarPlacar` recebe o contexto (relação nominal) e já houve um set. */
  estadoEquipes: EstadosDerivados | null
}

function contadoresVazios(): ContadoresEquipe {
  return { tempos: 0, substituicoesRegulares: 0, substituicoesExcepcionais: 0, trocasLibero: 0, redesignacoes: 0 }
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
  const sincronizarQuadra = () => {
    if (!eq || !st.saque) return
    eq.A = { ...eq.A, emQuadra: [...st.saque.formacaoA] }
    eq.B = { ...eq.B, emQuadra: [...st.saque.formacaoB] }
  }
  const idDoMembro = (membro: string): number | null => (membro.startsWith('J:') ? Number(membro.slice(2)) : null)

  const concedePonto = (set: SetDerivado, seq: number, equipe: Equipe, origem: PontoDerivado['origem']) => {
    if (eq) {
      eq.A = registrarRallyConcluido(eq.A)
      eq.B = registrarRallyConcluido(eq.B)
    }
    set.pontos.push({ seq, equipe, origem, cancelado: false })
    if (st.saque) {
      const prox = aplicarRally(st.saque, equipe)
      st.saque = { saca: prox.saca, formacaoA: [...prox.formacaoA], formacaoB: [...prox.formacaoB] }
    }
    recalcular(set, config)
  }

  for (const e of efetivos) {
    if (wo || aRepetir) {
      rejeitar(e.seq, 'RG-WO-001', 'Evento após o encerramento por WO/repetição da partida foi ignorado.')
      continue
    }
    switch (e.tipo) {
      case 'SET_INICIADO': {
        const p = e.payload
        const anterior = atual()
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
        }
        sets.push(set)
        st.saque = { formacaoA: [...p.formacaoA], formacaoB: [...p.formacaoB], saca: p.saqueInicial }
        if (contexto) {
          const sancoes: SancaoRegistrada[] = eq?.sancoes ?? []
          const novo = (equipe: Equipe, formacao: number[], liberos: number[] | undefined): EstadoEquipe => {
            const elenco = [...contexto.elenco[equipe]]
            const base = eq
              ? iniciarNovoSet(eq[equipe], formacao)
              : criarEstadoEquipe({ elenco, liberos: (liberos ?? []).filter((l) => elenco.includes(l)), formacaoInicial: formacao })
            // Expulsão aplicada entre sets vale no set que começa agora (RG-SAN-010).
            const expulsos = sancoes
              .filter((s) => s.equipe === equipe && s.sancao === 'EXPULSAO' && s.set === p.numeroSet)
              .map((s) => idDoMembro(s.membro))
              .filter((j): j is number => j !== null)
            return { ...base, expulsosNoSet: expulsos }
          }
          eq = { A: novo('A', p.formacaoA, p.liberosA), B: novo('B', p.formacaoB, p.liberosB), sancoes }
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
        if (eq) {
          const jogador = idDoMembro(p.membro)
          const sancao = p.sancao as TipoSancao
          eq.sancoes.push({
            equipe: p.equipe,
            membro: p.membro,
            categoria: p.categoria as CategoriaSancao,
            sancao,
            set: (set?.numero ?? 0) + (p.entreSets ? 1 : 0) || 1,
          })
          if (jogador !== null && sancao === 'EXPULSAO' && !p.entreSets && !eq[p.equipe].expulsosNoSet.includes(jogador)) {
            eq[p.equipe] = { ...eq[p.equipe], expulsosNoSet: [...eq[p.equipe].expulsosNoSet, jogador] }
          }
          if (jogador !== null && sancao === 'DESQUALIFICACAO' && !eq[p.equipe].desqualificados.includes(jogador)) {
            eq[p.equipe] = { ...eq[p.equipe], desqualificados: [...eq[p.equipe].desqualificados, jogador] }
          }
        }
        if (p.pontoParaAdversario) {
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
        const vivos: PontoLog[] = set.pontos.filter((x) => !x.cancelado).map((x) => ({ seq: x.seq, equipe: x.equipe }))
        const reversao = calcularReversaoFaltaRotacao(vivos, {
          equipeFaltosa: p.equipeFaltosa,
          momentoSeq: p.momentoSeq,
          pontoDoRallyDaFaltaSeq: p.pontoDoRallyDaFaltaSeq ?? null,
        })
        for (const ponto of set.pontos) if (reversao.cancelados.includes(ponto.seq)) ponto.cancelado = true
        if (reversao.cancelados.length > 0) houveCancelamento = true
        // O set pode ter sido reaberto pela reversão: o ponto do adversário entra normalmente.
        set.encerrado = false
        if (p.formacaoCorrigida) {
          st.saque = {
            ...st.saque,
            ...(p.equipeFaltosa === 'A' ? { formacaoA: [...p.formacaoCorrigida] } : { formacaoB: [...p.formacaoCorrigida] }),
          }
        }
        concedePonto(set, e.seq, outraEquipe(p.equipeFaltosa), 'FALTA_ROTACAO')
        break
      }
      case 'SUBSTITUICAO': {
        const set = atual()
        if (!set || !st.saque) {
          rejeitar(e.seq, 'RG-SUB-006', 'Substituição sem set em andamento.')
          break
        }
        const p = e.payload
        if (p.equipe === 'A') st.saque = { ...st.saque, formacaoA: trocarNaFormacao(st.saque.formacaoA, p.sai, p.entra) }
        else st.saque = { ...st.saque, formacaoB: trocarNaFormacao(st.saque.formacaoB, p.sai, p.entra) }
        const c = set.contadores[p.equipe]
        if (p.excepcional) c.substituicoesExcepcionais += 1
        else c.substituicoesRegulares += 1
        if (eq) {
          const pedido = { sai: p.sai, entra: p.entra }
          const r = p.excepcional
            ? aplicarSubstituicaoExcepcional(eq[p.equipe], { ...pedido, motivo: p.motivo as MotivoExcepcional }, config.perfil)
            : aplicarSubstituicaoRegular(eq[p.equipe], pedido, config.perfil)
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
        set.contadores[e.payload.equipe].tempos += 1
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
        if (e.payload.acao === 'REPETIR_PARTIDA') aRepetir = true
        break
      }
      case 'WO': {
        wo = resolverWO(config, {
          ausente: e.payload.ausente,
          setsJogados: sets.filter((s) => s.encerrado).map((s) => s.placar),
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
      case 'RALLY_REPETIDO':
        break
    }
    sincronizarQuadra()
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
