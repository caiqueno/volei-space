import { isCampeonatoFinalizado } from '@/lib/championship-finalization'

export function escolherPartidaDestaque<T>(grupos: { aoVivo: T[]; proximos: T[] }, statusCampeonato?: string | null): T | null {
  if (isCampeonatoFinalizado(statusCampeonato)) return null
  return grupos.aoVivo[0] ?? grupos.proximos[0] ?? null
}

export function mostrarProximoJogo(input: { statusCampeonato?: string | null; emAndamento: boolean; temJogoPendente: boolean }) {
  if (isCampeonatoFinalizado(input.statusCampeonato)) return false
  return input.emAndamento || input.temJogoPendente
}
