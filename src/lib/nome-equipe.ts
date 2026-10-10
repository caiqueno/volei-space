/** Nome gravado e exibido da equipe. Não altera apelido, slug nem nome de atleta. */
export function normalizarNomeEquipe(nome: string): string {
  return nome.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR')
}
