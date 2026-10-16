// O que cada papel pode fazer no time. Espelha o contrato (docs/analise/20-contrato-meu-time.yaml):
//   Leitura: todos os papéis. Atletas e inscrição: RESPONSAVEL e TECNICO.
//   Comissão técnica: RESPONSAVEL e TECNICO. Dados do time e acesso (membros): só RESPONSAVEL.
// Isto só esconde botões. Quem recusa de verdade é o servidor (403 SEM_PERMISSAO).
import { MENSAGEM_SO_RESPONSAVEL, MENSAGEM_SO_RESPONSAVEL_OU_TECNICO } from './respostas'
import type { PapelAcesso } from './tipos'

export type Acao = 'atletas' | 'inscricao' | 'comissao' | 'dados' | 'acesso'

const PAPEIS_POR_ACAO: Record<Acao, PapelAcesso[]> = {
  atletas: ['RESPONSAVEL', 'TECNICO'],
  inscricao: ['RESPONSAVEL', 'TECNICO'],
  comissao: ['RESPONSAVEL', 'TECNICO'],
  dados: ['RESPONSAVEL'],
  acesso: ['RESPONSAVEL'],
}

/**
 * Papel desconhecido (servidor antigo, sem `meuPapel`): mostra as ações e o servidor decide.
 * Papel conhecido: só o que o contrato permite.
 */
export function podeFazer(papel: PapelAcesso | undefined, acao: Acao): boolean {
  if (papel === undefined) return true
  return PAPEIS_POR_ACAO[acao].includes(papel)
}

/** Mensagem para quem não pode: diz quem pode, sem termo técnico. */
export function mensagemSemPermissao(acao: Acao): string {
  return PAPEIS_POR_ACAO[acao].length === 1 ? MENSAGEM_SO_RESPONSAVEL : MENSAGEM_SO_RESPONSAVEL_OU_TECNICO
}
