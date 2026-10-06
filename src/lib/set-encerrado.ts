export type SetPlacar = { numero: number; pontosA: number; pontosB: number }

export type RegraSet = {
  setsPorPartida: number
  pontosPorSet: number
  tieBreakUltimoSet?: boolean
  pontosUltimoSet?: number
  diferencaMinimaSet?: number
}

export function setEstaEncerrado(set: SetPlacar, regras: RegraSet) {
  const alvo = set.numero === regras.setsPorPartida && regras.tieBreakUltimoSet
    ? Number(regras.pontosUltimoSet) || regras.pontosPorSet
    : regras.pontosPorSet
  const maior = Math.max(set.pontosA, set.pontosB)
  const diferenca = Math.abs(set.pontosA - set.pontosB)
  const minima = Number(regras.diferencaMinimaSet) > 0 ? Number(regras.diferencaMinimaSet) : 2
  return Number.isInteger(alvo) && alvo >= 1 && maior >= alvo && diferenca >= minima
}
