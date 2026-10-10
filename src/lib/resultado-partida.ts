export type PartidaDecisao = {
  status?: string | null
  equipeAId: number
  equipeBId: number
  setsPorA?: number | null
  setsPorB?: number | null
  vencedorId?: number | null
}

const STATUS_DECIDIDO = new Set(['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA'])

export function vencedorDaPartida(partida: PartidaDecisao): number | null {
  const status = String(partida.status ?? '').trim().toUpperCase()
  if (!STATUS_DECIDIDO.has(status)) return null
  const equipeAId = Number(partida.equipeAId)
  const equipeBId = Number(partida.equipeBId)
  const explicito = partida.vencedorId == null ? null : Number(partida.vencedorId)
  if (explicito === equipeAId || explicito === equipeBId) return explicito
  const setsA = Number(partida.setsPorA ?? 0)
  const setsB = Number(partida.setsPorB ?? 0)
  if (setsA === setsB) return null
  return setsA > setsB ? equipeAId : equipeBId
}

export function perdedorDaPartida(partida: PartidaDecisao): number | null {
  const vencedorId = vencedorDaPartida(partida)
  if (vencedorId == null) return null
  return vencedorId === Number(partida.equipeAId) ? Number(partida.equipeBId) : Number(partida.equipeAId)
}

export function vencedoresDosAlimentadores(
  anteriores: Array<PartidaDecisao & { rodada: number }>,
  slot: number,
): number[] | null {
  const ids: number[] = []
  for (const rodada of [slot * 2 - 1, slot * 2]) {
    const partida = anteriores.find((item) => Number(item.rodada) === rodada)
    if (!partida) return null
    const vencedorId = vencedorDaPartida(partida)
    if (vencedorId == null) return null
    ids.push(vencedorId)
  }
  return ids
}

export function perdedoresDasSemifinais(semis: Array<PartidaDecisao & { rodada: number }>): number[] | null {
  const ids: number[] = []
  for (const rodada of [1, 2]) {
    const partida = semis.find((item) => Number(item.rodada) === rodada)
    if (!partida) return null
    const perdedorId = perdedorDaPartida(partida)
    if (perdedorId == null) return null
    ids.push(perdedorId)
  }
  return ids
}
