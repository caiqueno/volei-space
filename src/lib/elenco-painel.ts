export type CampeonatoElenco = {
  id: number
  nome: string
  simulacao?: boolean | null
}

export function campeonatosDoElenco(ligas: CampeonatoElenco[]) {
  return ligas.filter((liga) => liga.simulacao !== true && Number.isInteger(Number(liga.id)) && Number(liga.id) > 0)
}

export function escolherLigaDoElenco(ligas: CampeonatoElenco[], pedido: number | null) {
  const visiveis = campeonatosDoElenco(ligas)
  if (visiveis.length === 0) return pedido && pedido > 0 ? pedido : null
  if (pedido && visiveis.some((liga) => liga.id === pedido)) return pedido
  return visiveis[0].id
}
