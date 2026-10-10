const FASES_MATA_MATA: Record<string, string> = {
  FINAL: 'Final',
  SEMIFINAL: 'Semifinal',
  SEMIFINAIS: 'Semifinal',
  QUARTAS: 'Quartas de final',
  QUARTAS_DE_FINAL: 'Quartas de final',
  OITAVAS: 'Oitavas de final',
  OITAVAS_DE_FINAL: 'Oitavas de final',
  DEZESSEIS_AVOS: 'Dezesseis avos de final',
  DEZESSEIS_AVOS_DE_FINAL: 'Dezesseis avos de final',
  TERCEIRO_LUGAR: '3º lugar',
}

const ORDEM_FASE: Record<string, number> = {
  DEZESSEIS_AVOS: 32,
  DEZESSEIS_AVOS_DE_FINAL: 32,
  OITAVAS: 16,
  OITAVAS_DE_FINAL: 16,
  QUARTAS: 8,
  QUARTAS_DE_FINAL: 8,
  SEMIFINAL: 4,
  SEMIFINAIS: 4,
  TERCEIRO_LUGAR: 3,
  FINAL: 2,
}

export function formatFaseMataMata(fase?: string | null): string | null {
  if (!fase) return null
  return FASES_MATA_MATA[fase.trim().toUpperCase()] ?? null
}

export function ordemFaseMataMata(fase?: string | null): number {
  return ORDEM_FASE[String(fase ?? '').trim().toUpperCase()] ?? 0
}

export function rotuloConfronto(
  partida: { rodada?: number | null; fase?: string | null },
  roundLabel?: string,
): string {
  if (roundLabel) return roundLabel
  const fase = formatFaseMataMata(partida.fase)
  if (fase) return fase
  const rodada = Number(partida.rodada)
  if (Number.isFinite(rodada) && rodada > 0) return `Rodada ${rodada}`
  return 'Jogo'
}

export function textoLocalAusente(valor?: string | null): boolean {
  const texto = String(valor ?? '').trim().toLowerCase()
  return texto === '' || texto === 'a definir' || texto === 'definir' || texto === 'local a definir'
}

const STATUS_ENCERRADO = new Set(['ENCERRADA', 'WO', 'FINALIZADA', 'FINISHED'])

export function statusEncerrado(status?: string | null) {
  const valor = String(status ?? '').trim().toUpperCase().replaceAll(' ', '_')
  return STATUS_ENCERRADO.has(valor)
}

export function formatarDataPartida(valor?: string | Date | null) {
  if (!valor) return null
  const date = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type AgendaPartida = {
  rotulo: string
  data: string | null
  local: string | null
}

/** Mata-mata usa o nome da fase. Data e local «a definir» somem quando a partida já encerrou. */
export function agendaDaPartida(
  partida: {
    status?: string | null
    dataHora?: string | Date | null
    localNome?: string | null
    rodada?: number | null
    fase?: string | null
  },
  roundLabel?: string,
): AgendaPartida {
  const encerrada = statusEncerrado(partida.status)
  const data = formatarDataPartida(partida.dataHora)
  const localAusente = textoLocalAusente(partida.localNome)
  const local = partida.localNome?.trim() ?? ''
  return {
    rotulo: rotuloConfronto(partida, roundLabel),
    data: data ?? (encerrada ? null : 'A definir'),
    local: local && !(encerrada && localAusente) ? local : null,
  }
}
