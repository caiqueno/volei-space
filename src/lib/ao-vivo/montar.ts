/**
 * Ao vivo público (R11): montagem PURA do payload, sem I/O e SEM dados pessoais.
 * Só entram nomes de equipe, placares, número de sets e quem saca. Nunca jogadores, árbitros,
 * documentos, telefones, fotos nem tokens. Ver docs/analise/28-ao-vivo-publico.md.
 */
import type { PlacarDerivado } from '@/lib/regras-volei'

export type LadoAoVivo = 'A' | 'B'

export interface PayloadAoVivo {
  partida: {
    id: number
    equipeA: string
    equipeB: string
    status: string
    setsA: number
    setsB: number
    setAtual: number | null
    pontosA: number
    pontosB: number
    sacador: LadoAoVivo | null
  }
  sets: Array<{ numero: number; a: number; b: number }>
  atualizadoEm: string
}

export interface PartidaAoVivoLinha {
  id: number
  status?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
}

export interface SetLinha {
  numero: number
  pontosA: number
  pontosB: number
}

const STATUS_ENCERRADOS = ['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'CANCELADA', 'A_REPETIR']

function inteiro(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

export const NOME_A_DEFINIR = 'A definir'

/** Derivado do log do motor (fonte preferida, mais fresca). */
export function payloadDoLog(params: {
  partida: PartidaAoVivoLinha
  equipeA: string | null
  equipeB: string | null
  placar: PlacarDerivado
  agora?: Date
}): PayloadAoVivo {
  const { partida, placar } = params
  const encerrada = placar.status === 'ENCERRADA' || placar.status === 'WO' || placar.status === 'A_REPETIR'
  const atual = encerrada ? null : placar.setAtual
  // Status do banco (vocabulário do produto) quando já encerrada/aprovada; senão o do motor.
  const statusBanco = String(partida.status ?? '').toUpperCase()
  const status = STATUS_ENCERRADOS.includes(statusBanco)
    ? statusBanco
    : placar.status === 'NAO_INICIADA'
      ? statusBanco || 'AGENDADA'
      : placar.status
  return {
    partida: {
      id: partida.id,
      equipeA: params.equipeA ?? NOME_A_DEFINIR,
      equipeB: params.equipeB ?? NOME_A_DEFINIR,
      status,
      setsA: placar.setsGanhos.a,
      setsB: placar.setsGanhos.b,
      setAtual: atual ? atual.numero : null,
      pontosA: atual ? atual.placar.a : 0,
      pontosB: atual ? atual.placar.b : 0,
      sacador: atual && !atual.encerrado ? placar.saca : null,
    },
    sets: placar.sets.map((s) => ({ numero: s.numero, a: s.placar.a, b: s.placar.b })),
    atualizadoEm: (params.agora ?? new Date()).toISOString(),
  }
}

/**
 * Sem log do motor: placar por SetPartida. O sacador não é conhecido (null).
 * O set atual é o último com placar gravado enquanto a partida não terminou.
 */
export function payloadDosSets(params: {
  partida: PartidaAoVivoLinha
  equipeA: string | null
  equipeB: string | null
  sets: readonly SetLinha[]
  agora?: Date
}): PayloadAoVivo {
  const { partida } = params
  const sets = [...params.sets].sort((x, y) => x.numero - y.numero)
  const status = String(partida.status ?? '').toUpperCase() || 'AGENDADA'
  const encerrada = STATUS_ENCERRADOS.includes(status)
  const ultimo = sets[sets.length - 1] ?? null
  const atual = !encerrada && ultimo && status !== 'AGENDADA' ? ultimo : null
  return {
    partida: {
      id: partida.id,
      equipeA: params.equipeA ?? NOME_A_DEFINIR,
      equipeB: params.equipeB ?? NOME_A_DEFINIR,
      status,
      setsA: inteiro(partida.setsPorA),
      setsB: inteiro(partida.setsPorB),
      setAtual: atual ? atual.numero : null,
      pontosA: atual ? inteiro(atual.pontosA) : 0,
      pontosB: atual ? inteiro(atual.pontosB) : 0,
      sacador: null,
    },
    sets: sets.map((s) => ({ numero: inteiro(s.numero), a: inteiro(s.pontosA), b: inteiro(s.pontosB) })),
    atualizadoEm: (params.agora ?? new Date()).toISOString(),
  }
}
