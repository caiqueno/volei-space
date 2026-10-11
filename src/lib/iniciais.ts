/** Duas primeiras iniciais, em maiúsculas. Espaço repetido não ocupa vaga, salvo quando o cartão de MVP pede. */
export function iniciais(nome: string, opcoes?: { manterEspacosRepetidos?: boolean }): string {
  const partes = opcoes?.manterEspacosRepetidos ? nome.split(' ') : nome.split(' ').filter(Boolean)
  return partes.slice(0, 2).map((parte) => (parte[0] ?? '').toUpperCase()).join('')
}
