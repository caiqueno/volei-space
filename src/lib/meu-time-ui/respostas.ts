// Traduz falhas do servidor em mensagens simples. Nunca mostra termo técnico ao usuário.

export type TipoFalha = 'nao-habilitado' | 'sem-sessao' | 'sem-permissao' | 'nao-encontrado' | 'conflito' | 'validacao' | 'rede' | 'outro'

export type Falha = { tipo: TipoFalha; status: number; codigo?: string; mensagem: string }

export const MENSAGEM_NAO_HABILITADO = 'O Meu Time ainda não está habilitado para você. Assim que estiver, esta área abre sozinha.'

const MENSAGENS_PADRAO: Record<TipoFalha, string> = {
  'nao-habilitado': MENSAGEM_NAO_HABILITADO,
  'sem-sessao': 'Entre na sua conta para ver o seu time.',
  'sem-permissao': 'Você não tem permissão para mexer neste time.',
  'nao-encontrado': 'Não encontramos o que você procura. Volte para a lista de times.',
  conflito: 'Isso entra em conflito com o que já está cadastrado. Confira os dados e tente de novo.',
  validacao: 'Confira os dados informados e tente de novo.',
  rede: 'Sem internet agora. Seus dados continuam guardados neste aparelho. Tente de novo quando voltar.',
  outro: 'Não deu certo agora. Tente de novo em instantes.',
}

function tipoPorStatus(status: number): TipoFalha {
  if (status === 503) return 'nao-habilitado'
  if (status === 401) return 'sem-sessao'
  if (status === 403) return 'sem-permissao'
  if (status === 404) return 'nao-encontrado'
  if (status === 409) return 'conflito'
  if (status === 400 || status === 422) return 'validacao'
  return 'outro'
}

function pareceTecnica(texto: string) {
  return /supabase|prisma|bucket|sql|stack|undefined|null|exception|ECONN|<\w+/i.test(texto)
}

/** Monta a falha a partir do status HTTP e do corpo `{error, codigo?}`. */
export function classificarFalha(status: number, corpo: unknown): Falha {
  const tipo = tipoPorStatus(status)
  const objeto = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {}
  const erro = typeof objeto.error === 'string' ? objeto.error.trim() : ''
  const codigo = typeof objeto.codigo === 'string' ? objeto.codigo : undefined
  // 503 e 5xx sempre usam o texto nosso; mensagens de validação do servidor já vêm em português simples.
  const usarServidor = erro && !pareceTecnica(erro) && (tipo === 'validacao' || tipo === 'conflito')
  return { tipo, status, codigo, mensagem: usarServidor ? erro : MENSAGENS_PADRAO[tipo] }
}

export function falhaDeRede(): Falha {
  return { tipo: 'rede', status: 0, mensagem: MENSAGENS_PADRAO.rede }
}

/** Extrai o dado do envelope `{data}`; devolve null se o corpo não segue o contrato. */
export function extrairData<T>(corpo: unknown): T | null {
  if (!corpo || typeof corpo !== 'object' || !('data' in corpo)) return null
  return (corpo as { data: T }).data
}

const ROTULO_STATUS: Record<string, { rotulo: string; explicacao: string; tom: 'ok' | 'aviso' | 'erro' }> = {
  CONFIRMADA: { rotulo: 'Inscrição confirmada', explicacao: 'Seu time está na categoria. Você pode ajustar atletas até o prazo do organizador.', tom: 'ok' },
  CONFIRMADA_COM_PENDENCIAS: { rotulo: 'Confirmada, com pendências', explicacao: 'Seu time está inscrito, mas ainda faltam itens. Resolva dentro do prazo.', tom: 'aviso' },
  AJUSTE_PEDIDO: { rotulo: 'Ajuste pedido', explicacao: 'O organizador pediu uma mudança na inscrição. Abra a inscrição e ajuste.', tom: 'aviso' },
  REMOVIDA: { rotulo: 'Removida pelo organizador', explicacao: 'O organizador removeu esta inscrição. Fale com ele para resolver.', tom: 'erro' },
}

export function descreverStatusInscricao(status: string) {
  return ROTULO_STATUS[status] ?? { rotulo: 'Situação em atualização', explicacao: 'Atualize a página em instantes.', tom: 'aviso' as const }
}
