export type SlotPublico = {
  fase?: string
  partida: {
    status: string
    equipeA: { id?: number; nome: string }
    equipeB: { id?: number; nome: string }
    setsPorA: number | null
    setsPorB: number | null
    sets: Array<{ numero: number; pontosA: number; pontosB: number }>
  } | null
} | null

export function resumirChavePublica<T extends { fase: string; slots: unknown[] }>(rounds: T[], terceiro: unknown) {
  const finalRound = [...rounds].reverse().find((round) => round.fase === 'FINAL')
  return {
    temMataMata: rounds.length > 0,
    final: (finalRound?.slots[0] ?? null) as SlotPublico,
    terceiro: (terceiro ?? null) as SlotPublico,
  }
}
