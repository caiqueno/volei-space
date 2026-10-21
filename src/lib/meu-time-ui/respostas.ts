// Traduz falhas do servidor em mensagens simples. Nunca mostra termo técnico ao usuário.

import type { Atleta, RegrasCategoria, ResultadoLote } from './tipos'

export type TipoFalha = 'nao-habilitado' | 'sem-sessao' | 'sem-permissao' | 'nao-encontrado' | 'conflito' | 'validacao' | 'rede' | 'outro'

export type Falha = {
  tipo: TipoFalha
  status: number
  codigo?: string
  mensagem: string
  /** Lista de violações (422), já em linguagem simples, quando o servidor a envia. */
  detalhes?: string[]
}

export const MENSAGEM_NAO_HABILITADO = 'O Meu Time ainda não está habilitado para você. Assim que estiver, é só voltar aqui.'

const MENSAGENS_PADRAO: Record<TipoFalha, string> = {
  'nao-habilitado': MENSAGEM_NAO_HABILITADO,
  'sem-sessao': 'Sua sessão acabou ou você ainda não entrou. Entre na sua conta para continuar.',
  'sem-permissao': 'Você não tem permissão para fazer isso neste time. Peça a quem é responsável pelo time.',
  'nao-encontrado': 'Não encontramos o que você procura. O time pode não ser da sua conta. Volte para a lista de times.',
  conflito: 'Isso entra em conflito com o que já está cadastrado. Confira os dados e tente de novo.',
  validacao: 'Confira os dados informados e tente de novo.',
  rede: 'Sem internet agora. Seus dados continuam guardados neste aparelho. Tente de novo quando voltar.',
  outro: 'Não deu certo agora. Tente de novo em instantes.',
}

export const MENSAGEM_COMISSAO_INDISPONIVEL =
  'A comissão técnica ainda não está disponível neste ambiente. O resto do time (atletas, inscrição, dados) funciona normalmente.'

export const MENSAGEM_SO_RESPONSAVEL = 'Só o responsável pelo time pode fazer isso.'
export const MENSAGEM_SO_RESPONSAVEL_OU_TECNICO = 'Só o responsável ou o técnico do time pode fazer isso.'

/**
 * Flag desligada: o servidor responde 404 `{error:'Não encontrado.'}` sem `codigo` (contrato).
 * Os 404 de verdade (equipe, atleta, categoria) sempre trazem `codigo`.
 */
function recursoDesligado(status: number, corpo: unknown) {
  if (status !== 404 || !corpo || typeof corpo !== 'object') return false
  const o = corpo as Record<string, unknown>
  return o.codigo === undefined && typeof o.error === 'string' && o.error.trim().toLowerCase() === 'não encontrado.'
}

function tipoPorStatus(status: number, corpo?: unknown): TipoFalha {
  if (status === 503 || recursoDesligado(status, corpo)) return 'nao-habilitado'
  if (status === 401) return 'sem-sessao'
  if (status === 403) return 'sem-permissao'
  if (status === 404) return 'nao-encontrado'
  if (status === 409) return 'conflito'
  if (status === 400 || status === 422) return 'validacao'
  return 'outro'
}

/** Texto nosso para códigos conhecidos do servidor; vence a mensagem genérica do status. */
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  EQUIPE_DUPLICADA: 'Você já tem um time com esse nome e naipe. Use outro nome ou abra o time que já existe.',
  ATLETA_DUPLICADO: 'Esse atleta já está no time (mesmo nome e nascimento).',
  CPF_DUPLICADO: 'Esse CPF já está cadastrado em outro atleta. Confira se digitou certo.',
  MEMBRO_DUPLICADO:'Essa pessoa já tem acesso a este time.',
  RESPONSAVEL_FIXO: 'O responsável pelo time não pode ser removido por aqui.',
  JA_INSCRITA: 'Este time já está inscrito nesta categoria.',
  CONFLITO_DE_ELENCO: 'Algum atleta já está em outro time desta categoria. Confira o elenco.',
  CONTA_NAO_ENCONTRADA: 'Não achamos uma conta com esse e-mail. A pessoa precisa criar a conta no volei.space antes.',
  CATEGORIA_NAO_ENCONTRADA: 'Não encontramos essa categoria. Peça um link de convite novo ao organizador.',
  SEM_PERMISSAO: 'Você não tem permissão para isso neste time. Peça ao responsável ou ao técnico do time.',
  INSCRICOES_FECHADAS: 'As inscrições desta categoria estão fechadas.',
  CONVITE_INVALIDO: 'Este convite não vale mais. Peça um link novo ao organizador.',
}

function pareceTecnica(texto: string) {
  return /supabase|prisma|bucket|sql|stack|undefined|null|exception|ECONN|<\w+/i.test(texto)
}

/** Monta a falha a partir do status HTTP e do corpo `{error, codigo?}`. */
export function classificarFalha(status: number, corpo: unknown): Falha {
  const tipo = tipoPorStatus(status, corpo)
  const objeto = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {}
  const erro = typeof objeto.error === 'string' ? objeto.error.trim() : ''
  const codigo = typeof objeto.codigo === 'string' ? objeto.codigo : undefined
  // 503 e 5xx sempre usam o texto nosso; mensagens de validação do servidor já vêm em português simples.
  const usarServidor = erro && !pareceTecnica(erro) && (tipo === 'validacao' || tipo === 'conflito')
  const doCodigo = tipo !== 'nao-habilitado' && codigo ? MENSAGENS_POR_CODIGO[codigo] : undefined
  const falha: Falha = { tipo, status, codigo, mensagem: doCodigo ?? (usarServidor ? erro : MENSAGENS_PADRAO[tipo]) }
  const lista = Array.isArray(objeto.erros) ? objeto.erros : []
  const detalhes = lista
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).mensagem : null))
    .filter((m): m is string => typeof m === 'string' && m.trim() !== '' && !pareceTecnica(m))
  if (detalhes.length > 0 && tipo === 'validacao') falha.detalhes = detalhes
  return falha
}

export function falhaDeRede(): Falha {
  return { tipo: 'rede', status: 0, mensagem: MENSAGENS_PADRAO.rede }
}

/** Extrai o dado do envelope `{data}`; devolve null se o corpo não segue o contrato. */
export function extrairData<T>(corpo: unknown): T | null {
  if (!corpo || typeof corpo !== 'object' || !('data' in corpo)) return null
  return (corpo as { data: T }).data
}

function inteiroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.trunc(valor) : null
}

/** Valida o corpo de GET /categorias/:id/regras. Limite null = sem limite (categoria sem RegraElenco). */
export function normalizarRegrasCategoria(dado: unknown): RegrasCategoria | null {
  if (!dado || typeof dado !== 'object') return null
  const o = dado as Record<string, unknown>
  const minimo = inteiroOuNulo(o.minimoAtletas)
  const maximo = inteiroOuNulo(o.maximoAtletas)
  const liberos = inteiroOuNulo(o.maximoLiberos)
  // Contrato: sem RegraElenco valem os padrões (limites null, maximoLiberos 2). Null nunca bloqueia a inscrição.
  const maximoLiberos = liberos ?? 2
  if ((minimo != null && minimo < 1) || (maximo != null && maximo < 1) || (minimo != null && maximo != null && maximo < minimo) || maximoLiberos < 0) return null
  const naipe = o.naipe === 'FEMININO' || o.naipe === 'MASCULINO' || o.naipe === 'MISTO' ? o.naipe : null
  return {
    categoriaId: typeof o.categoriaId === 'string' ? o.categoriaId : '',
    nome: typeof o.nome === 'string' ? o.nome : '',
    naipe,
    minimoAtletas: minimo,
    maximoAtletas: maximo,
    maximoLiberos,
    maximoComissao: inteiroOuNulo(o.maximoComissao),
    anoNascimentoMinimo: inteiroOuNulo(o.anoNascimentoMinimo),
    anoNascimentoMaximo: inteiroOuNulo(o.anoNascimentoMaximo),
    inscricoesAbertas: o.inscricoesAbertas !== false,
  }
}

/** O servidor devolve `criados` como lista de atletas (contrato) ou como número (versões antigas). */
export function normalizarResultadoLote(dado: unknown): ResultadoLote | null {
  if (!dado || typeof dado !== 'object') return null
  const o = dado as Record<string, unknown>
  const atletasCriados = Array.isArray(o.criados)
    ? (o.criados as unknown[]).filter((a): a is Atleta => !!a && typeof a === 'object' && typeof (a as Atleta).id === 'string' && typeof (a as Atleta).nome === 'string')
    : []
  const criados = Array.isArray(o.criados) ? atletasCriados.length : (inteiroOuNulo(o.criados) ?? 0)
  const ignorados = Array.isArray(o.ignorados)
    ? (o.ignorados as unknown[]).flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const i = item as Record<string, unknown>
        return typeof i.linha === 'number' && typeof i.motivo === 'string' ? [{ linha: i.linha, motivo: i.motivo }] : []
      })
    : []
  return { criados, atletasCriados, ignorados }
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
