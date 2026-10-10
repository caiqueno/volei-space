import { rodadaDaVolta, vencedorAgregado } from '@/lib/ida-volta'

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

function mesmosTimes(esquerda: PartidaDecisao, direita: PartidaDecisao) {
  const times = (partida: PartidaDecisao) => [Number(partida.equipeAId), Number(partida.equipeBId)].sort((a, b) => a - b).join(':')
  return times(esquerda) === times(direita)
}

function vencedorDaRodada(anteriores: Array<PartidaDecisao & { rodada: number }>, rodada: number) {
  const ida = anteriores.find((item) => Number(item.rodada) === rodada)
  if (!ida) return null
  const volta = anteriores.find((item) => Number(item.rodada) === rodadaDaVolta(rodada) && mesmosTimes(item, ida))
  if (!volta) return vencedorDaPartida(ida)
  return vencedorAgregado(ida, volta)
}

export function vencedoresDosAlimentadores(
  anteriores: Array<PartidaDecisao & { rodada: number }>,
  slot: number,
): number[] | null {
  const ids: number[] = []
  for (const rodada of [slot * 2 - 1, slot * 2]) {
    const vencedorId = vencedorDaRodada(anteriores, rodada)
    if (vencedorId == null) return null
    ids.push(vencedorId)
  }
  return ids
}

export function perdedoresDasSemifinais(semis: Array<PartidaDecisao & { rodada: number }>): number[] | null {
  const ids: number[] = []
  for (const rodada of [1, 2]) {
    const vencedorId = vencedorDaRodada(semis, rodada)
    if (vencedorId == null) return null
    const ida = semis.find((item) => Number(item.rodada) === rodada)
    if (!ida) return null
    ids.push(vencedorId === Number(ida.equipeAId) ? Number(ida.equipeBId) : Number(ida.equipeAId))
  }
  return ids
}
