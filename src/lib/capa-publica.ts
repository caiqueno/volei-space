const CAPAS_PADRAO = [
  '/images/capas/volei-01.jpg',
  '/images/capas/volei-02.jpg',
  '/images/capas/volei-03.jpg',
  '/images/capas/volei-04.jpg',
] as const

export function capaDoCampeonato(id: number, capaUrl?: string | null, logoUrl?: string | null) {
  const propria = capaUrl?.trim() || logoUrl?.trim()
  if (propria) return propria
  return CAPAS_PADRAO[Math.abs(Math.trunc(id)) % CAPAS_PADRAO.length]
}
