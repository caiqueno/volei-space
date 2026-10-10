/**
 * Tempos da súmula. Sem número gravado, cada equipe segue com 2.
 * O tempo de equipe só existe quando separarTempos está true.
 */
export const LIMITE_TEMPOS_POR_SET = 2

export function limiteDeTempos(valor: unknown): number {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 1 || numero > 4) return LIMITE_TEMPOS_POR_SET
  return numero
}

export function textoTempoTecnico(equipe: string, usados: number, set: number, limite = LIMITE_TEMPOS_POR_SET) {
  return `Tempo técnico solicitado por ${equipe} (${usados}/${limite} no set ${set}).`
}

export function textoTempoEquipe(equipe: string, usados: number, set: number, limite = LIMITE_TEMPOS_POR_SET) {
  return `Tempo de equipe solicitado por ${equipe} (${usados}/${limite} no set ${set}).`
}

export function ehTempoDeEquipe(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('tempo de equipe')
}

export function colunaDeTemposAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /limiteTemposPorSet|separarTempos/i.test(texto)
}

export function semTempos<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.limiteTemposPorSet
  delete saida.separarTempos
  return saida
}

export function soTempos(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(patch, 'limiteTemposPorSet')) saida.limiteTemposPorSet = patch.limiteTemposPorSet
  if (Object.prototype.hasOwnProperty.call(patch, 'separarTempos')) saida.separarTempos = patch.separarTempos === true
  return saida
}
