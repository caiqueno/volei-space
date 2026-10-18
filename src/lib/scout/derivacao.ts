/**
 * Derivação do scout a partir do log de eventos do motor (sem lançamento manual). Função pura.
 *
 * O que o log permite: quem ganhou cada rally, quem sacava (pelo rodízio), em que rotação cada
 * equipe estava, séries de pontos, substituições e tempos. O que NÃO permite: o fundamento do
 * lance (ace, ataque, bloqueio, erro...). Por isso não há ace/erro de saque aqui: há "ponto no saque".
 * Ver docs/analise/26-scout.md.
 */
import {
  derivarPlacar,
  eventosEfetivos,
  trocasDoPayload,
  type ConfigPartida,
  type ContextoDerivacao,
  type Equipe,
  type SetDerivado,
  type SumulaEvento,
} from '@/lib/regras-volei'
import { aplicarRally, type EstadoSaque } from '@/lib/regras-volei/rotacao'

/** Estado do set num instante do log: placar e rotação de cada equipe (1 a 6, relativa à formação inicial do set). */
export interface EstadoDoSetNoMomento {
  placarA: number
  placarB: number
  rotacaoA: number
  rotacaoB: number
}

/**
 * Placar e rotação do set `setNumero` ao fim do log (o "momento" em que uma ação nova é lançada), derivados com
 * `derivarPlacar`. Null quando o set não está no log (ex.: ainda não iniciado). Pontos cancelados não contam.
 */
export function estadoDoSetNoMomento(
  log: readonly SumulaEvento[],
  config: ConfigPartida,
  setNumero: number,
  contexto?: ContextoDerivacao,
): EstadoDoSetNoMomento | null {
  const placar = derivarPlacar(log, config, contexto)
  const set = placar.sets.find((s) => s.numero === setNumero)
  if (!set) return null
  let estado: EstadoSaque = { formacaoA: [...set.formacaoInicialA], formacaoB: [...set.formacaoInicialB], saca: set.sacouPrimeiro }
  const rotacao = { A: 1, B: 1 }
  for (const passo of set.jornal) {
    if (passo.tipo === 'TROCA') {
      const troca = (f: readonly number[]) => f.map((j) => (j === passo.sai ? passo.entra : j))
      estado = passo.equipe === 'A' ? { ...estado, formacaoA: troca(estado.formacaoA) } : { ...estado, formacaoB: troca(estado.formacaoB) }
      continue
    }
    if (passo.ponto.cancelado) continue
    const prox = aplicarRally(estado, passo.ponto.equipe)
    if (prox.saca !== estado.saca) rotacao[prox.saca] = (rotacao[prox.saca] % 6) + 1
    estado = prox
  }
  return { placarA: set.placar.a, placarB: set.placar.b, rotacaoA: rotacao.A, rotacaoB: rotacao.B }
}

export type TipoPontoScout = 'PONTO_NO_SAQUE' | 'SIDE_OUT' | 'ADMINISTRATIVO'

export interface PontoScout {
  set: number
  seq: number
  equipe: Equipe
  origem: 'RALLY' | 'PENALIDADE' | 'FALTA_POSICAO' | 'FALTA_ROTACAO' | 'PAPELETA'
  /** PONTO_NO_SAQUE: a equipe que sacava venceu; SIDE_OUT: a que recebia venceu; ADMINISTRATIVO: sem rally. */
  tipo: TipoPontoScout
  /** Placar do set antes do ponto. */
  placarAntesA: number
  placarAntesB: number
  /** Quem sacava no rally (nulo no ponto administrativo). */
  sacadorEquipe: Equipe | null
  sacadorJogador: number | null
  /** Rotação (1 a 6, relativa à formação inicial do set) de cada equipe quando o rally começou. */
  rotacaoA: number
  rotacaoB: number
  /** Quantos pontos seguidos a equipe tem, contando este. */
  sequenciaAtual: number
}

export interface SequenciaPontos {
  set: number
  equipe: Equipe
  tamanho: number
  placarAntesA: number
  placarAntesB: number
}

export interface SacadorScout {
  equipe: Equipe
  jogadorId: number
  /** Saques de rally (ponto administrativo não conta). */
  saques: number
  pontosNoSaque: number
  /** Saques em que a equipe perdeu o rally (erro de saque OU rally perdido: o log não separa). */
  saquesPerdidos: number
  /** Maior série de pontos seguidos num mesmo turno de saque. */
  maiorSerie: number
  /** pontosNoSaque / saques; null sem saque. */
  aproveitamento: number | null
}

export interface FaseRotacao {
  rallies: number
  pontos: number
  aproveitamento: number | null
}

export interface RotacaoScout {
  rotacao: number
  /** Rallies com a equipe sacando. */
  saque: FaseRotacao
  /** Rallies com a equipe recebendo (pontos = side-outs). */
  recepcao: FaseRotacao
}

export interface EventoTempoScout {
  seq: number
  set: number
  equipe: Equipe
  placarA: number
  placarB: number
}

export interface EventoSubstituicaoScout {
  seq: number
  set: number
  equipe: Equipe
  sai: number
  entra: number
  tipo: 'REGULAR' | 'EXCEPCIONAL' | 'LIBERO' | 'REDESIGNACAO_LIBERO'
  placarA: number
  placarB: number
}

export interface SetScout {
  numero: number
  encerrado: boolean
  vencedor: Equipe | null
  pontosA: number
  pontosB: number
  pontosPorOrigem: Record<PontoScout['origem'], number>
  pontosCancelados: number
  maiorSequenciaA: number
  maiorSequenciaB: number
  tempos: { A: number; B: number }
  substituicoes: { A: number; B: number }
  trocasLibero: { A: number; B: number }
  /** Do SET_INICIADO ao último PONTO, pelo `criadoEm` dos eventos (hora de gravação). Null sem horários. */
  duracaoSegundos: number | null
  interrupcaoMinutos: number
}

export interface DerivacaoScout {
  status: string
  setsGanhos: { a: number; b: number }
  vencedor: Equipe | null
  inconsistencias: number
  sets: SetScout[]
  pontos: PontoScout[]
  sequencias: SequenciaPontos[]
  maiorSequencia: { A: number; B: number }
  sacadores: SacadorScout[]
  porRotacao: { A: RotacaoScout[]; B: RotacaoScout[] }
  /** Saque da partida inteira por equipe: pontos no saque / saques de rally. */
  eficienciaSaque: { A: FaseRotacao; B: FaseRotacao }
  tempos: EventoTempoScout[]
  substituicoes: EventoSubstituicaoScout[]
}

function razao(pontos: number, total: number): number | null {
  return total > 0 ? pontos / total : null
}

function fase(): { rallies: number; pontos: number } {
  return { rallies: 0, pontos: 0 }
}

function fechar(f: { rallies: number; pontos: number }): FaseRotacao {
  return { rallies: f.rallies, pontos: f.pontos, aproveitamento: razao(f.pontos, f.rallies) }
}

function oposta(e: Equipe): Equipe {
  return e === 'A' ? 'B' : 'A'
}

function segundosEntre(inicio?: string, fim?: string): number | null {
  if (!inicio || !fim) return null
  const a = Date.parse(inicio)
  const b = Date.parse(fim)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 1000)
}

export function derivarScoutDoLog(
  log: readonly SumulaEvento[],
  config: ConfigPartida,
  contexto?: ContextoDerivacao,
): DerivacaoScout {
  const placar = derivarPlacar(log, config, contexto)
  const efetivos = eventosEfetivos(log)

  const pontos: PontoScout[] = []
  const sequencias: SequenciaPontos[] = []
  const mapaSacadores = new Map<string, SacadorScout>()
  const rot = {
    A: Array.from({ length: 6 }, () => ({ saque: fase(), recepcao: fase() })),
    B: Array.from({ length: 6 }, () => ({ saque: fase(), recepcao: fase() })),
  }
  const saqueEquipe = { A: fase(), B: fase() }
  const sets: SetScout[] = []

  const sacadorDe = (equipe: Equipe, jogadorId: number): SacadorScout => {
    const chave = `${equipe}:${jogadorId}`
    let s = mapaSacadores.get(chave)
    if (!s) {
      s = { equipe, jogadorId, saques: 0, pontosNoSaque: 0, saquesPerdidos: 0, maiorSerie: 0, aproveitamento: null }
      mapaSacadores.set(chave, s)
    }
    return s
  }

  for (const set of placar.sets) {
    let estado: EstadoSaque = {
      formacaoA: [...set.formacaoInicialA],
      formacaoB: [...set.formacaoInicialB],
      saca: set.sacouPrimeiro,
    }
    const rotacao = { A: 1, B: 1 }
    let a = 0
    let b = 0
    let runEquipe: Equipe | null = null
    let runTamanho = 0
    let runInicio = { a: 0, b: 0 }
    const maior = { A: 0, B: 0 }
    const porOrigem: SetScout['pontosPorOrigem'] = { RALLY: 0, PENALIDADE: 0, FALTA_POSICAO: 0, FALTA_ROTACAO: 0, PAPELETA: 0 }

    // Turno de saque: mesmo sacador, pontos seguidos da equipe que saca.
    type Turno = { equipe: Equipe; jogador: number; pontos: number }
    const tr: { cur: Turno | null } = { cur: null }
    const abrirTurno = () => {
      const f = estado.saca === 'A' ? estado.formacaoA : estado.formacaoB
      tr.cur = { equipe: estado.saca, jogador: f[0]!, pontos: 0 }
    }
    const fecharTurno = () => {
      const t = tr.cur
      if (!t) return
      const s = sacadorDe(t.equipe, t.jogador)
      s.maiorSerie = Math.max(s.maiorSerie, t.pontos)
      tr.cur = null
    }
    abrirTurno()

    for (const passo of set.jornal) {
      if (passo.tipo === 'TROCA') {
        const troca = (f: readonly number[]) => f.map((j) => (j === passo.sai ? passo.entra : j))
        estado = passo.equipe === 'A' ? { ...estado, formacaoA: troca(estado.formacaoA) } : { ...estado, formacaoB: troca(estado.formacaoB) }
        // Troca do jogador que está sacando muda o sacador: abre outro turno.
        const atual = tr.cur
        const f = estado.saca === 'A' ? estado.formacaoA : estado.formacaoB
        if (atual && (atual.jogador !== f[0] || atual.equipe !== estado.saca)) {
          fecharTurno()
          abrirTurno()
        }
        continue
      }
      const p = passo.ponto
      if (p.cancelado) continue

      const sacadorEquipe = estado.saca
      const formSaca = sacadorEquipe === 'A' ? estado.formacaoA : estado.formacaoB
      const sacadorJogador = formSaca[0] ?? null
      const ehRally = p.origem === 'RALLY'
      const tipo: TipoPontoScout = !ehRally ? 'ADMINISTRATIVO' : p.equipe === sacadorEquipe ? 'PONTO_NO_SAQUE' : 'SIDE_OUT'

      if (runEquipe === p.equipe) runTamanho += 1
      else {
        if (runEquipe) sequencias.push({ set: set.numero, equipe: runEquipe, tamanho: runTamanho, placarAntesA: runInicio.a, placarAntesB: runInicio.b })
        runEquipe = p.equipe
        runTamanho = 1
        runInicio = { a, b }
      }
      maior[p.equipe] = Math.max(maior[p.equipe], runTamanho)

      pontos.push({
        set: set.numero,
        seq: p.seq,
        equipe: p.equipe,
        origem: p.origem,
        tipo,
        placarAntesA: a,
        placarAntesB: b,
        sacadorEquipe: ehRally ? sacadorEquipe : null,
        sacadorJogador: ehRally ? sacadorJogador : null,
        rotacaoA: rotacao.A,
        rotacaoB: rotacao.B,
        sequenciaAtual: runTamanho,
      })
      porOrigem[p.origem] += 1

      if (ehRally) {
        const receptora = oposta(sacadorEquipe)
        const fS = rot[sacadorEquipe][rotacao[sacadorEquipe] - 1]!.saque
        const fR = rot[receptora][rotacao[receptora] - 1]!.recepcao
        fS.rallies += 1
        fR.rallies += 1
        saqueEquipe[sacadorEquipe].rallies += 1
        if (sacadorJogador !== null) sacadorDe(sacadorEquipe, sacadorJogador).saques += 1
        if (p.equipe === sacadorEquipe) {
          fS.pontos += 1
          saqueEquipe[sacadorEquipe].pontos += 1
          if (sacadorJogador !== null) sacadorDe(sacadorEquipe, sacadorJogador).pontosNoSaque += 1
          if (tr.cur) tr.cur.pontos += 1
        } else {
          fR.pontos += 1
          if (sacadorJogador !== null) sacadorDe(sacadorEquipe, sacadorJogador).saquesPerdidos += 1
        }
      }

      if (p.equipe === 'A') a += 1
      else b += 1
      const prox = aplicarRally(estado, p.equipe)
      if (prox.saca !== estado.saca) {
        rotacao[prox.saca] = (rotacao[prox.saca] % 6) + 1
        fecharTurno()
        estado = prox
        abrirTurno()
      } else {
        estado = prox
      }
    }
    fecharTurno()
    if (runEquipe) sequencias.push({ set: set.numero, equipe: runEquipe, tamanho: runTamanho, placarAntesA: runInicio.a, placarAntesB: runInicio.b })

    sets.push({
      numero: set.numero,
      encerrado: set.encerrado,
      vencedor: set.vencedor,
      pontosA: set.placar.a,
      pontosB: set.placar.b,
      pontosPorOrigem: porOrigem,
      pontosCancelados: set.pontos.filter((x) => x.cancelado).length,
      maiorSequenciaA: maior.A,
      maiorSequenciaB: maior.B,
      tempos: { A: set.contadores.A.tempos, B: set.contadores.B.tempos },
      substituicoes: {
        A: set.contadores.A.substituicoesRegulares + set.contadores.A.substituicoesExcepcionais,
        B: set.contadores.B.substituicoesRegulares + set.contadores.B.substituicoesExcepcionais,
      },
      trocasLibero: { A: set.contadores.A.trocasLibero, B: set.contadores.B.trocasLibero },
      duracaoSegundos: null,
      interrupcaoMinutos: 0,
    })
  }

  // Linha do tempo (tempos, substituições) e duração: varre os eventos efetivos.
  const todosSets: SetDerivado[] = [...placar.sets, ...placar.setsAnulados].sort((x, y) => x.inicioSeq - y.inicioSeq)
  const setDoSeq = (seq: number): SetDerivado | null => {
    let achado: SetDerivado | null = null
    for (const s of todosSets) if (s.inicioSeq <= seq) achado = s
    return achado
  }
  const ehVigente = (s: SetDerivado | null): s is SetDerivado => !!s && placar.sets.includes(s)
  const placarNoSeq = (s: SetDerivado, seq: number) => {
    let a = 0
    let b = 0
    for (const p of s.pontos) {
      if (p.cancelado || p.seq >= seq) continue
      if (p.equipe === 'A') a += 1
      else b += 1
    }
    return { a, b }
  }

  const tempos: EventoTempoScout[] = []
  const substituicoes: EventoSubstituicaoScout[] = []
  const horarios = new Map<number, { inicio?: string; fim?: string }>()
  const interrupcao = new Map<number, number>()
  const inconsistentes = new Set(placar.inconsistencias.map((i) => i.seq))

  for (const e of efetivos) {
    if (inconsistentes.has(e.seq)) continue
    const s = setDoSeq(e.seq)
    if (!ehVigente(s)) continue
    switch (e.tipo) {
      case 'SET_INICIADO': {
        const h = horarios.get(s.numero) ?? {}
        h.inicio = e.criadoEm
        horarios.set(s.numero, h)
        break
      }
      case 'PONTO': {
        const h = horarios.get(s.numero) ?? {}
        h.fim = e.criadoEm ?? h.fim
        horarios.set(s.numero, h)
        break
      }
      case 'INTERRUPCAO':
        interrupcao.set(s.numero, (interrupcao.get(s.numero) ?? 0) + (Number.isFinite(e.payload.minutos) ? e.payload.minutos : 0))
        break
      case 'TEMPO': {
        const pl = placarNoSeq(s, e.seq)
        tempos.push({ seq: e.seq, set: s.numero, equipe: e.payload.equipe, placarA: pl.a, placarB: pl.b })
        break
      }
      case 'SUBSTITUICAO': {
        const pl = placarNoSeq(s, e.seq)
        for (const t of trocasDoPayload(e.payload)) {
          substituicoes.push({
            seq: e.seq, set: s.numero, equipe: e.payload.equipe, sai: t.sai, entra: t.entra,
            tipo: e.payload.excepcional ? 'EXCEPCIONAL' : 'REGULAR', placarA: pl.a, placarB: pl.b,
          })
        }
        break
      }
      case 'TROCA_LIBERO': {
        const pl = placarNoSeq(s, e.seq)
        substituicoes.push({ seq: e.seq, set: s.numero, equipe: e.payload.equipe, sai: e.payload.sai, entra: e.payload.entra, tipo: 'LIBERO', placarA: pl.a, placarB: pl.b })
        break
      }
      case 'REDESIGNACAO_LIBERO': {
        const pl = placarNoSeq(s, e.seq)
        substituicoes.push({ seq: e.seq, set: s.numero, equipe: e.payload.equipe, sai: e.payload.liberoIncapaz, entra: e.payload.novoLibero, tipo: 'REDESIGNACAO_LIBERO', placarA: pl.a, placarB: pl.b })
        break
      }
      default:
        break
    }
  }
  for (const s of sets) {
    const h = horarios.get(s.numero)
    s.duracaoSegundos = segundosEntre(h?.inicio, h?.fim)
    s.interrupcaoMinutos = interrupcao.get(s.numero) ?? 0
  }

  const sacadores = Array.from(mapaSacadores.values())
    .map((s) => ({ ...s, aproveitamento: razao(s.pontosNoSaque, s.saques) }))
    .sort((x, y) => x.equipe.localeCompare(y.equipe) || x.jogadorId - y.jogadorId)

  const maiorSequencia = { A: 0, B: 0 }
  for (const q of sequencias) maiorSequencia[q.equipe] = Math.max(maiorSequencia[q.equipe], q.tamanho)

  const porRotacao = (e: Equipe): RotacaoScout[] =>
    rot[e].map((r, i) => ({ rotacao: i + 1, saque: fechar(r.saque), recepcao: fechar(r.recepcao) }))

  return {
    status: placar.status,
    setsGanhos: placar.setsGanhos,
    vencedor: placar.vencedor,
    inconsistencias: placar.inconsistencias.length,
    sets,
    pontos,
    sequencias,
    maiorSequencia,
    sacadores,
    porRotacao: { A: porRotacao('A'), B: porRotacao('B') },
    eficienciaSaque: { A: fechar(saqueEquipe.A), B: fechar(saqueEquipe.B) },
    tempos,
    substituicoes,
  }
}
