import { numeroSemCamisa } from '@/lib/numero-camisa-partida'

/** Número da camisa da súmula. Sem número e -1 ficam por último. */
export function chaveCamisaDaSumula(camisa: string): number | null {
  const texto = String(camisa ?? '').trim()
  if (!texto || numeroSemCamisa(texto)) return null
  if (!/^\d+$/.test(texto)) return null
  return Number(texto)
}

export function compararCamisaDaSumula(a: { camisa: string; nome: string }, b: { camisa: string; nome: string }) {
  const esquerda = chaveCamisaDaSumula(a.camisa)
  const direita = chaveCamisaDaSumula(b.camisa)
  if (esquerda == null && direita == null) return a.nome.localeCompare(b.nome, 'pt-BR')
  if (esquerda == null) return 1
  if (direita == null) return -1
  if (esquerda !== direita) return esquerda - direita
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export function ordenarPorCamisaDaSumula<T>(itens: readonly T[], camisa: (item: T) => string, nome: (item: T) => string) {
  return [...itens].sort((a, b) => compararCamisaDaSumula(
    { camisa: camisa(a), nome: nome(a) },
    { camisa: camisa(b), nome: nome(b) },
  ))
}
