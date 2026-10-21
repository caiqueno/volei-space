// Notificações multicanal (R18). Flag: NOTIFICACOES_MULTICANAL_ATIVO=1. Desligada, as rotas novas respondem 404
// e `notificar` só grava a notificação interna, como antes.
export const MENSAGEM_CANAIS_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

export function multicanalAtivo(env: Record<string, string | undefined> = process.env) {
  return env.NOTIFICACOES_MULTICANAL_ATIVO === '1'
}

export const CANAIS = ['EMAIL', 'WHATSAPP', 'PUSH'] as const
export type Canal = (typeof CANAIS)[number]

/** Todos os tipos de notificação que o usuário pode ligar ou desligar por canal. */
export const TIPOS_NOTIFICACAO = [
  'CONVITE_ACEITO',
  'IMPORTACAO_CONFIRMADA',
  'AJUSTE_PEDIDO',
  'SOLICITACAO_INSCRICAO',
  'SOLICITACAO_APROVADA',
  'SOLICITACAO_RECUSADA',
  'INSCRICAO_APROVADA',
  'INSCRICAO_EM_ANALISE',
  'INSCRICAO_RECUSADA',
  'INSCRICAO_LISTA_ESPERA',
  'INSCRICAO_PROMOVIDA',
  'INSCRICAO_RESPOSTA',
  'PRAZO_INSCRICAO',
  'JOGO_AMANHA',
  'TABELA_PUBLICADA',
] as const

/** Tipos críticos: o e-mail vem ligado por padrão (o usuário pode desligar). */
export const TIPOS_CRITICOS: readonly string[] = [
  'AJUSTE_PEDIDO',
  'SOLICITACAO_APROVADA',
  'SOLICITACAO_RECUSADA',
  'INSCRICAO_APROVADA',
  'INSCRICAO_RECUSADA',
  'INSCRICAO_LISTA_ESPERA',
  'INSCRICAO_PROMOVIDA',
  'PRAZO_INSCRICAO',
  'JOGO_AMANHA',
  'TABELA_PUBLICADA',
]

export const MAXIMO_TENTATIVAS = 5
export const LIMITE_POR_EXECUCAO = 50
/** Recuo exponencial: 1, 2, 4, 8 minutos entre as tentativas. */
export function recuoEmMs(tentativasFeitas: number) {
  return 60_000 * 2 ** Math.max(0, tentativasFeitas - 1)
}
