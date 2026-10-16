/**
 * Explicação de regras na tela da súmula: transforma o resultado do motor em uma caixa
 * persistente (código RG-xxx, mensagem e ação corretiva). Módulo PURO.
 */
import type { AvisoRegra } from '@/lib/regras-volei'

export type CaixaRegra = {
  tipo: 'bloqueio' | 'aviso'
  codigo: string
  mensagem: string
  acao: string
}

const ACAO_PADRAO = 'Corrija o lançamento e tente de novo. Se o árbitro decidiu de outra forma, registre em Anotações.'

const ACOES: Record<string, string> = {
  'RG-SUB-001': 'Siga o set com os atletas em quadra. Em caso de lesão, doença, expulsão ou desqualificação use a substituição excepcional.',
  'RG-SUB-003': 'Escolha o titular que saiu ou o reserva que o substituiu: cada par só troca entre si.',
  'RG-SUB-004': 'Escolha o titular que este reserva substituiu, ou outro reserva que ainda não entrou no set.',
  'RG-SUB-006': 'Escolha um atleta em quadra para sair e um reserva que esteja fora de quadra para entrar.',
  'RG-SUB-007': 'Confirme com o árbitro: o pedido pode ter mais de um atleta, mas só depois de um rally se houver novo pedido.',
  'RG-SUB-009': 'Avise o árbitro: substituição acima do limite oficial é ilegal na FIVB/CBV. Registre em Anotações se mantiver.',
  'RG-SUB-011': 'Use a substituição regular, se houver. A excepcional só vale sem substituição legal e para atleta que não volta ao jogo.',
  'RG-SUB-012': 'Sem substituto legal, a equipe é declarada incompleta: avise o árbitro e registre em Anotações.',
  'RG-SUB-013': 'Conceda 3 minutos de recuperação (uma vez por atleta). Se não se recuperar, a equipe fica incompleta.',
  'RG-FOR-009': 'Escolha um atleta que conste na relação nominal da equipe nesta partida.',
  'RG-SAN-007': 'Escolha outro atleta: o expulso fica fora até o fim do set.',
  'RG-SAN-008': 'Escolha outro atleta: o desqualificado não participa mais da partida.',
  'RG-LIB-001': 'Ajuste os líberos: no máximo 2 por equipe, todos da relação nominal.',
  'RG-LIB-002': 'Tire o líbero que está em quadra antes de entrar com outro.',
  'RG-LIB-003': 'Troque o líbero apenas por jogador de fundo de quadra (posições I, V ou VI).',
  'RG-LIB-005': 'Conclua um rally (registre um ponto) antes de nova troca de líbero.',
  'RG-LIB-006': 'O líbero só sai para o jogador que ele substituiu ou para o outro líbero.',
  'RG-LIB-008': 'Faça a troca com a bola fora de jogo e antes do apito do saque.',
  'RG-LIB-010': 'Escolha um novo líbero que esteja fora de quadra e na relação nominal.',
  'RG-LIB-011': 'Escolha outro atleta: o líbero incapaz ou redesignado não joga mais.',
  'RG-LIB-012': 'A equipe segue com o outro líbero; a redesignação só vale sem líbero capaz.',
  'RG-TMP-001': 'Cada equipe tem direito a 2 tempos por set. Siga o jogo.',
  'RG-TMP-007': 'Primeiro atraso da equipe: advertência, sem ponto.',
  'RG-TMP-008': 'Atraso repetido da equipe: penalidade, com ponto e saque ao adversário.',
}

export function acaoCorretiva(codigo: string): string {
  return ACOES[codigo] ?? ACAO_PADRAO
}

export function caixaDeBloqueio(codigo: string, mensagem: string): CaixaRegra {
  return { tipo: 'bloqueio', codigo, mensagem, acao: acaoCorretiva(codigo) }
}

export function caixaDeAviso(aviso: AvisoRegra | { codigo: string; mensagem: string }): CaixaRegra {
  return { tipo: 'aviso', codigo: aviso.codigo, mensagem: aviso.mensagem, acao: acaoCorretiva(aviso.codigo) }
}

export type Avaliacao = { ok: true; avisos: CaixaRegra[] } | { ok: false; caixa: CaixaRegra }
