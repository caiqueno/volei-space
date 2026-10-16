/** Texto "Troca 3 de 8" do modal de substituição. O limite vem da regra da categoria (não é calculado aqui). */
export function textoContadorTroca(usadas: number, limite: number) {
  const total = Math.max(0, Math.floor(limite))
  const feitas = Math.max(0, Math.floor(usadas))
  if (total > 0 && feitas >= total) return `${feitas} de ${total} trocas usadas neste set.`
  return `Troca ${feitas + 1} de ${total} neste set.`
}

/** Junta o contador ao aviso de bloqueio (se houver), nesta ordem. */
export function avisoComContador(contador: string, aviso: string | null) {
  return aviso ? `${contador} ${aviso}` : contador
}
