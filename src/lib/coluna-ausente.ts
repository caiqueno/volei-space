/**
 * Coluna ausente no erro do PostgREST ou do Postgres.
 * O texto é `code`, `message` e `details` do objeto recebido.
 * Quem antes não lia `details` passa só `code` e `message`.
 * Cada nome é um trecho literal, sem diferenciar maiúsculas.
 * Um RegExp é aplicado como está, para o limite de palavra de `sexo`.
 */
export type ErroDeColuna = {
  message?: string | null
  code?: string | null
  details?: string | null
} | null | undefined

export function colunaAusente(erro: ErroDeColuna, nomes: readonly (string | RegExp)[]) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  const minusculo = texto.toLowerCase()
  return nomes.some((nome) => {
    if (nome instanceof RegExp) return nome.test(texto)
    if (nome.length === 0) return false
    return minusculo.includes(nome.toLowerCase())
  })
}
