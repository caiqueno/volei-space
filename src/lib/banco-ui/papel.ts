/** Papel de quem abre o banco por sessão. Módulo PURO. */

/** Assistente só vê e pede; o líder (e o acesso por token, sem papel) pode enviar a papeleta. Papel desconhecido: só leitura. */
export function papelSomenteLeitura(papel: string | null | undefined): boolean {
  if (papel === undefined || papel === null || papel === '') return false
  return String(papel).toUpperCase() !== 'LIDER'
}
