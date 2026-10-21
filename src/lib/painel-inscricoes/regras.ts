// Regras puras do painel de inscrições (sem banco, sem rede): transições de status, nome abreviado,
// pendências agregadas e CSV seguro. Tudo que o servidor decide fica aqui para ser testado isoladamente.

export const STATUS_PAINEL = [
  'RASCUNHO',
  'CONFIRMADA',
  'CONFIRMADA_COM_PENDENCIAS',
  'AJUSTE_PEDIDO',
  'REMOVIDA',
  'EM_ANALISE',
  'LISTA_ESPERA',
] as const
export type StatusPainel = (typeof STATUS_PAINEL)[number]

export const ACOES = ['APROVAR', 'ANALISAR', 'PEDIR_CORRECAO', 'LISTA_ESPERA', 'RECUSAR'] as const
export type AcaoDecisao = (typeof ACOES)[number]

/** Status que ocupa uma vaga da categoria (equipe já dentro). */
export const STATUS_OCUPA_VAGA: readonly string[] = ['CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS']

/** Status de destino de cada ação (APROVAR pode virar LISTA_ESPERA quando não há vaga; ver `resolverAprovacao`). */
export const DESTINO_DA_ACAO: Record<AcaoDecisao, StatusPainel> = {
  APROVAR: 'CONFIRMADA',
  ANALISAR: 'EM_ANALISE',
  PEDIR_CORRECAO: 'AJUSTE_PEDIDO',
  LISTA_ESPERA: 'LISTA_ESPERA',
  RECUSAR: 'REMOVIDA',
}

/** De quais status cada ação pode partir. O próprio destino é idempotente e tratado à parte. */
const ORIGENS: Record<AcaoDecisao, readonly string[]> = {
  APROVAR: ['CONFIRMADA_COM_PENDENCIAS', 'EM_ANALISE', 'AJUSTE_PEDIDO', 'LISTA_ESPERA'],
  ANALISAR: ['CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO'],
  PEDIR_CORRECAO: ['CONFIRMADA_COM_PENDENCIAS', 'EM_ANALISE', 'CONFIRMADA'],
  LISTA_ESPERA: ['CONFIRMADA_COM_PENDENCIAS', 'EM_ANALISE', 'AJUSTE_PEDIDO'],
  RECUSAR: ['CONFIRMADA_COM_PENDENCIAS', 'EM_ANALISE', 'AJUSTE_PEDIDO', 'LISTA_ESPERA', 'CONFIRMADA'],
}

export function transicaoValida(acao: AcaoDecisao, statusAtual: string) {
  return ORIGENS[acao].includes(statusAtual)
}

/** Mensagem de 409 para uma transição que não existe. */
export function mensagemTransicaoInvalida(acao: AcaoDecisao, statusAtual: string) {
  if (statusAtual === 'RASCUNHO') return 'A equipe ainda não enviou esta inscrição (rascunho).'
  if (statusAtual === 'REMOVIDA') return 'Esta inscrição já foi recusada ou removida.'
  return `Não é possível aplicar ${acao} a uma inscrição em ${statusAtual}.`
}

export type ResolucaoAprovacao = { destino: 'CONFIRMADA' | 'LISTA_ESPERA' }

/**
 * APROVAR: equipe que já ocupa vaga continua nela; as demais só entram se houver vaga na categoria
 * (limite nulo/0 = sem limite). Sem vaga vão para a lista de espera.
 */
export function resolverAprovacao(statusAtual: string, ocupadasPorOutras: number, limite: number | null): ResolucaoAprovacao {
  if (STATUS_OCUPA_VAGA.includes(statusAtual)) return { destino: 'CONFIRMADA' }
  if (limite != null && limite > 0 && ocupadasPorOutras >= limite) return { destino: 'LISTA_ESPERA' }
  return { destino: 'CONFIRMADA' }
}

// --- Texto -----------------------------------------------------------------

/** "Maria Souza Lima" -> "Maria L." (primeiro nome + inicial do último sobrenome). Sem PII completa. */
export function nomeAbreviado(nome: unknown) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  const ultimo = partes[partes.length - 1]
  return `${partes[0]} ${ultimo[0].toUpperCase()}.`
}

export type AtletaParaPendencia = { documentosOk?: boolean | null; capitao?: boolean | null }
export type RegraParaPendencia = { atletasMin?: number | null; atletasMax?: number | null } | null | undefined

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Pendências agregadas e sem nomes: quantidade do elenco, documentos e capitão. */
export function pendenciasDaInscricao(atletas: AtletaParaPendencia[], regra: RegraParaPendencia): string[] {
  const lista: string[] = []
  const total = atletas.length
  if (regra?.atletasMin != null && total < regra.atletasMin) {
    lista.push(`Faltam ${plural(regra.atletasMin - total, 'atleta', 'atletas')} para o mínimo de ${regra.atletasMin}.`)
  }
  if (regra?.atletasMax != null && total > regra.atletasMax) {
    lista.push(`${plural(total - regra.atletasMax, 'atleta', 'atletas')} acima do máximo de ${regra.atletasMax}.`)
  }
  const semDocumento = atletas.filter((a) => !a.documentosOk).length
  if (semDocumento > 0) lista.push(`${plural(semDocumento, 'atleta sem documento', 'atletas sem documento')}.`)
  if (total > 0 && !atletas.some((a) => a.capitao)) lista.push('Nenhum capitão marcado.')
  return lista
}

// --- CSV -------------------------------------------------------------------------

export const VERSAO_ESQUEMA_CSV = 'inscricoes-v1'
export const CABECALHO_CSV = ['equipe', 'cidade', 'categoria', 'status', 'nº atletas', 'pendências', 'atualizado em'] as const

/** Neutraliza fórmula (=, +, -, @, tab e CR iniciais) e escapa para ';' com aspas. */
export function celulaCsv(valor: unknown) {
  let texto = String(valor ?? '').replace(/\r?\n/g, ' ')
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function linhaCsv(valores: unknown[]) {
  return valores.map(celulaCsv).join(';')
}

/** CSV UTF-8 com BOM, separador ';' e cabeçalho fixo na primeira linha. A versão do esquema vai no cabeçalho HTTP e no nome do arquivo. */
export function montarCsv(linhas: unknown[][]) {
  const corpo = [linhaCsv([...CABECALHO_CSV]), ...linhas.map(linhaCsv)]
  return `﻿${corpo.join('\r\n')}\r\n`
}
