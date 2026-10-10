/**
 * Líbero. Sem configuração, a escalação continua pedindo um líbero inicial
 * e a troca não conta como substituição. Só `false` tira a exigência.
 * Quantidade 1 ou 2 limita a lista. Qualquer outro valor não limita.
 */
/** A escalação guarda o número do cadastro. A lista mostra a camisa da súmula. */
export function entraNoSeletorDeLibero(numeroCadastro: string, escalacao: readonly string[]) {
  return !escalacao.includes(String(numeroCadastro))
}

export function rotuloSeletorLibero(nome: string, camisaDaSumula: string) {
  return `#${camisaDaSumula} - ${nome}`
}

export function quantidadeDeLiberos(valor: unknown): 1 | 2 | null {
  const numero = Number(valor)
  if (numero !== 1 && numero !== 2) return null
  return numero
}

export function colunaDeLiberoAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /exigirLiberoInicial|quantidadeLiberos/i.test(texto)
}

export function semLibero<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.exigirLiberoInicial
  delete saida.quantidadeLiberos
  return saida
}

export function soLibero(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(patch, 'exigirLiberoInicial')) saida.exigirLiberoInicial = patch.exigirLiberoInicial === true
  if (Object.prototype.hasOwnProperty.call(patch, 'quantidadeLiberos')) saida.quantidadeLiberos = quantidadeDeLiberos(patch.quantidadeLiberos)
  return saida
}
