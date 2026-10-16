/**
 * Fechamento da súmula: totais DERIVADOS do log (nunca digitados). RG-FEC-004, RG-SET-007, RG-SET-008.
 *
 * Por set: placar, vencedor, tempos, substituições, sanções por equipe, horário de início/fim e duração.
 * Da partida: soma de tempos, substituições, sanções, sets e pontos; início, fim e duração total.
 * Horários só existem se os eventos trouxerem `criadoEm` (o servidor grava na tabela); sem eles ficam null.
 */
import type { ConfigPartida } from './config'
import { derivarPlacar, type ContextoDerivacao, type StatusPartida, type SumulaEvento } from './eventos'
import { bloqueio, ok, type Equipe, type PlacarSet, type ResultadoRegra } from './tipos'

export interface ParPorEquipe {
  A: number
  B: number
}

export interface FechamentoSet {
  numero: number
  placar: PlacarSet
  encerrado: boolean
  vencedor: Equipe | null
  tempos: ParPorEquipe
  /** Regulares + excepcionais; trocas de líbero NÃO entram (RG-SET-008). */
  substituicoes: ParPorEquipe
  sancoes: ParPorEquipe
  inicioEm: string | null
  fimEm: string | null
  /** Minutos entre início e fim do set (sem intervalos). */
  duracaoMinutos: number | null
}

export interface FechamentoPartida {
  status: StatusPartida
  /** Só uma partida terminada (sets ou WO) pode ser fechada. */
  terminada: boolean
  vencedor: Equipe | null
  /** Resultado em sets (ex.: 3x1). */
  resultadoEmSets: { a: number; b: number }
  porSet: FechamentoSet[]
  totais: {
    tempos: ParPorEquipe
    substituicoes: ParPorEquipe
    /** Inclui as sanções de sets anulados (RG-INT-004: sanções são mantidas). */
    sancoes: ParPorEquipe
    pontos: ParPorEquipe
  }
  inicioEm: string | null
  fimEm: string | null
  /** Duração total do jogo (com intervalos), em minutos. */
  duracaoTotalMinutos: number | null
  /** Ex.: "2h00" (1 dígito de hora, Guia p.70-72). */
  duracaoTotalFormatada: string | null
  /** Soma da duração dos sets (sem intervalos), em minutos. */
  duracaoSetsMinutos: number | null
  inconsistencias: number
}

/** "2h00", "0h45", "1h05": 1 dígito de hora e minutos com 2 dígitos. */
export function formatarDuracao(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function minutosEntre(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null
  const a = Date.parse(inicio)
  const b = Date.parse(fim)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return Math.round((b - a) / 60000)
}

export function calcularFechamento(
  log: readonly SumulaEvento[],
  config: ConfigPartida,
  contexto?: ContextoDerivacao,
): FechamentoPartida {
  const placar = derivarPlacar(log, config, contexto)
  const horario = new Map<number, string>()
  for (const e of log) if (e.criadoEm) horario.set(e.seq, e.criadoEm)

  const porSet: FechamentoSet[] = placar.sets.map((s) => {
    const vivos = s.pontos.filter((p) => !p.cancelado)
    const ultimo = vivos[vivos.length - 1]
    const inicioEm = horario.get(s.inicioSeq) ?? null
    const fimEm = s.encerrado && ultimo ? (horario.get(ultimo.seq) ?? null) : null
    const c = s.contadores
    return {
      numero: s.numero,
      placar: { ...s.placar },
      encerrado: s.encerrado,
      vencedor: s.vencedor,
      tempos: { A: c.A.tempos, B: c.B.tempos },
      substituicoes: {
        A: c.A.substituicoesRegulares + c.A.substituicoesExcepcionais,
        B: c.B.substituicoesRegulares + c.B.substituicoesExcepcionais,
      },
      sancoes: { A: c.A.sancoes, B: c.B.sancoes },
      inicioEm,
      fimEm,
      duracaoMinutos: minutosEntre(inicioEm, fimEm),
    }
  })

  const soma = (f: (s: FechamentoSet) => ParPorEquipe): ParPorEquipe =>
    porSet.reduce((t, s) => ({ A: t.A + f(s).A, B: t.B + f(s).B }), { A: 0, B: 0 })
  const sancoes = soma((s) => s.sancoes)
  for (const anulado of placar.setsAnulados) {
    sancoes.A += anulado.contadores.A.sancoes
    sancoes.B += anulado.contadores.B.sancoes
  }
  const pontos = porSet.filter((s) => s.encerrado).reduce((t, s) => ({ A: t.A + s.placar.a, B: t.B + s.placar.b }), { A: 0, B: 0 })

  const terminada = placar.status === 'ENCERRADA' || placar.status === 'WO'
  const inicioEm = porSet.find((s) => s.inicioEm)?.inicioEm ?? null
  const eventoWO = placar.status === 'WO' ? [...log].reverse().find((e) => e.tipo === 'WO') : undefined
  const ultimoSetComFim = [...porSet].reverse().find((s) => s.fimEm)
  const fimEm = (eventoWO?.criadoEm ?? null) || (terminada ? (ultimoSetComFim?.fimEm ?? null) : null)
  const duracaoTotalMinutos = minutosEntre(inicioEm, fimEm)
  const duracoes = porSet.map((s) => s.duracaoMinutos)
  const duracaoSetsMinutos = duracoes.length > 0 && duracoes.every((d) => d !== null) ? duracoes.reduce<number>((t, d) => t + (d ?? 0), 0) : null

  return {
    status: placar.status,
    terminada,
    vencedor: placar.vencedor,
    resultadoEmSets: placar.wo ? { a: placar.wo.placarPartida.setsA, b: placar.wo.placarPartida.setsB } : { ...placar.setsGanhos },
    porSet,
    totais: { tempos: soma((s) => s.tempos), substituicoes: soma((s) => s.substituicoes), sancoes, pontos },
    inicioEm,
    fimEm,
    duracaoTotalMinutos,
    duracaoTotalFormatada: duracaoTotalMinutos === null ? null : formatarDuracao(duracaoTotalMinutos),
    duracaoSetsMinutos,
    inconsistencias: placar.inconsistencias.length,
  }
}

/** RG-FEC-004: o fechamento só vale com a partida terminada, sem inconsistências e com horários coerentes. */
export function validarFechamento(f: FechamentoPartida): ResultadoRegra {
  if (!f.terminada) return bloqueio('RG-FEC-004', 'A súmula só fecha com a partida terminada (sets concluídos ou WO).')
  if (f.inconsistencias > 0) {
    return bloqueio('RG-FEC-004', `O log tem ${f.inconsistencias} inconsistência(s): corrija antes de fechar os totais.`)
  }
  if (f.inicioEm && f.fimEm && Date.parse(f.fimEm) < Date.parse(f.inicioEm)) {
    return bloqueio('RG-SET-008', 'O horário de fim é anterior ao de início.')
  }
  if (f.status === 'ENCERRADA' && f.vencedor === null) {
    return bloqueio('RG-FEC-004', 'A partida encerrada precisa ter equipe vencedora.')
  }
  return ok()
}
