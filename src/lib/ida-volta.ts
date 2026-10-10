export const RODADA_VOLTA = 1000

export function rodadaDaVolta(rodada: number) {
  return Number(rodada) + RODADA_VOLTA
}

export function ehRodadaDeVolta(rodada: number) {
  return Number(rodada) > RODADA_VOLTA
}

type Lado = { equipeAId: number; equipeBId: number; rodada: number }

export function jogoDeVolta<T extends Lado>(jogo: T): T {
  return {
    ...jogo,
    rodada: rodadaDaVolta(jogo.rodada),
    equipeAId: jogo.equipeBId,
    equipeBId: jogo.equipeAId,
  }
}

type Perna = {
  status?: string | null
  equipeAId: number
  equipeBId: number
  setsPorA?: number | null
  setsPorB?: number | null
}

function encerrada(partida: Perna) {
  const status = String(partida.status ?? '').trim().toUpperCase()
  return status === 'ENCERRADA' || status === 'WO'
}

export function vencedorAgregado(ida: Perna, volta: Perna): number | null {
  if (!encerrada(ida) || !encerrada(volta)) return null
  const sets = new Map<number, number>()
  for (const partida of [ida, volta]) {
    sets.set(Number(partida.equipeAId), (sets.get(Number(partida.equipeAId)) ?? 0) + Number(partida.setsPorA ?? 0))
    sets.set(Number(partida.equipeBId), (sets.get(Number(partida.equipeBId)) ?? 0) + Number(partida.setsPorB ?? 0))
  }
  const times = Array.from(sets.keys())
  if (times.length !== 2) return null
  const [primeiro, segundo] = times
  const setsPrimeiro = sets.get(primeiro) ?? 0
  const setsSegundo = sets.get(segundo) ?? 0
  if (setsPrimeiro === setsSegundo) return null
  return setsPrimeiro > setsSegundo ? primeiro : segundo
}
