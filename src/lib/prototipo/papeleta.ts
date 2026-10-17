export const POSICOES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const
export type Papeleta = (string | null)[]

export const papeletaVazia = (): Papeleta => [null, null, null, null, null, null]

/** Coloca o atleta na posição; se já estava em outra, move (sem duplicar). */
export function atribuir(p: Papeleta, posicao: number, atletaId: string | null): Papeleta {
  if (posicao < 0 || posicao >= 6) return p
  const nova = p.map((x) => (atletaId && x === atletaId ? null : x))
  nova[posicao] = atletaId
  return nova
}

export function papeletaCompleta(p: Papeleta): boolean {
  return p.length === 6 && p.every(Boolean) && new Set(p).size === 6
}
