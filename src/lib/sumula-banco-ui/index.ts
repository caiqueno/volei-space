/**
 * Lógica pura do lado do apontador para o app de banco (pedidos e papeletas).
 * Sem React e sem rede: tudo aqui é testável. O servidor continua sendo a autoridade.
 */

export type TipoPedidoBanco = 'TEMPO' | 'SUBSTITUICAO' | 'DESAFIO'

export interface PedidoBanco {
  id: string | number
  equipeId: number
  tipo: TipoPedidoBanco
  estado: string
  payload?: { sai?: number | string | null; entra?: number | string | null } | null
  criadoEm?: string
}

export interface ItemFormacao {
  posicao: number
  jogadorId: number
}

export interface PapeletaBanco {
  equipeId: number
  estado: string
  formacao: ItemFormacao[]
  liberoId: number | null
  capitaoId: number | null
}

/** A flag liga o recurso inteiro; qualquer outro valor (inclusive ausente) deixa tudo desligado. */
export function bancoAppAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}

const NOME_TIPO: Record<TipoPedidoBanco, string> = {
  TEMPO: 'pede tempo',
  SUBSTITUICAO: 'pede troca',
  DESAFIO: 'pede desafio',
}

/** Rótulo do atleta para o texto; recebe o número de camisa já resolvido pela tela. */
export type RotuloJogador = (jogadorId: number) => string | null

function idNumerico(valor: unknown): number | null {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor
  return typeof n === 'number' && Number.isInteger(n) ? n : null
}

export function textoPedido(pedido: PedidoBanco, nomeEquipe: string, rotulo?: RotuloJogador): string {
  const base = `${nomeEquipe} ${NOME_TIPO[pedido.tipo] ?? 'faz um pedido'}`
  if (pedido.tipo !== 'SUBSTITUICAO') return base
  const sai = idNumerico(pedido.payload?.sai)
  const entra = idNumerico(pedido.payload?.entra)
  const partes: string[] = []
  if (sai != null) partes.push(`sai ${rotulo?.(sai) ?? `atleta ${sai}`}`)
  if (entra != null) partes.push(`entra ${rotulo?.(entra) ?? `atleta ${entra}`}`)
  return partes.length ? `${base}: ${partes.join(', ')}` : base
}

export interface ContextoAceite {
  /** A partida está em andamento (pedidos de tempo e troca só valem com o jogo rolando). */
  partidaEmAndamento: boolean
  /** Já existe uma decisão em voo para este pedido. */
  decidindo?: boolean
}

export type ResultadoAceite = { ok: true } | { ok: false; motivo: string }

/** Quando o apontador pode aceitar. A regra do motor (limite de tempos, trocas) é checada pela tela ao registrar. */
export function podeAceitar(pedido: PedidoBanco, contexto: ContextoAceite): ResultadoAceite {
  if (pedido.estado.toUpperCase() !== 'PENDENTE') return { ok: false, motivo: 'O pedido já foi decidido.' }
  if (contexto.decidindo) return { ok: false, motivo: 'Aguarde: a decisão está sendo enviada.' }
  if (pedido.tipo === 'DESAFIO') return { ok: true }
  if (!contexto.partidaEmAndamento) return { ok: false, motivo: 'A partida não está em andamento.' }
  if (pedido.tipo === 'SUBSTITUICAO') {
    if (idNumerico(pedido.payload?.sai) == null || idNumerico(pedido.payload?.entra) == null) {
      return { ok: false, motivo: 'O pedido de troca veio sem os atletas. Recuse e peça de novo.' }
    }
  }
  return { ok: true }
}

export function pedidosPendentes(pedidos: PedidoBanco[]): PedidoBanco[] {
  return pedidos.filter((p) => p.estado.toUpperCase() === 'PENDENTE')
}

export function papeletasEnviadas(papeletas: PapeletaBanco[]): PapeletaBanco[] {
  return papeletas.filter((p) => p.estado.toUpperCase() === 'ENVIADA' && p.formacao.length > 0)
}

/** Papeletas a mostrar ao apontador: enviadas e também as já aceitas (continuam visíveis, marcadas "Aceita", nos polls seguintes). */
export function papeletasParaExibir(papeletas: PapeletaBanco[]): PapeletaBanco[] {
  return papeletas.filter((p) => {
    const e = p.estado.toUpperCase()
    return (e === 'ENVIADA' || e === 'ACEITA') && p.formacao.length > 0
  })
}

export function papeletaJaAceita(p: Pick<PapeletaBanco, 'estado'>): boolean {
  return p.estado.toUpperCase() === 'ACEITA'
}

export interface LinkBancoAtivo {
  acessoId: string
  equipeId: number
  criadoEm: string | null
  expiraEm: string | null
  revogadoEm: string | null
}

/** Normaliza GET /api/banco/links?partidaId= ({data:[...]}), descartando itens malformados. */
export function normalizarLinksBanco(bruto: unknown): LinkBancoAtivo[] {
  if (!Array.isArray(bruto)) return []
  const saida: LinkBancoAtivo[] = []
  for (const x of bruto) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.acessoId === 'string' || typeof o.acessoId === 'number' ? String(o.acessoId) : ''
    const equipeId = idNumerico(o.equipeId)
    if (!id || equipeId === null) continue
    const txt = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
    saida.push({ acessoId: id, equipeId, criadoEm: txt(o.criadoEm), expiraEm: txt(o.expiraEm), revogadoEm: txt(o.revogadoEm) })
  }
  return saida
}

/** Links ainda válidos: não revogados e não expirados. Mais recentes primeiro. */
export function linksAtivos(links: readonly LinkBancoAtivo[], agora: number = Date.now()): LinkBancoAtivo[] {
  return links
    .filter((l) => {
      if (l.revogadoEm) return false
      const fim = l.expiraEm ? Date.parse(l.expiraEm) : NaN
      return !(Number.isFinite(fim) && fim <= agora)
    })
    .sort((a, b) => String(b.criadoEm ?? '').localeCompare(String(a.criadoEm ?? '')))
}

export interface Divergencia {
  tipo: 'POSICAO' | 'LIBERO'
  posicao?: number
  papeleta: number | null
  escalacao: number | null
}

/**
 * Compara a papeleta do banco com a escalação confirmada na tela. A diferença só vale quando os dois
 * lados têm valor (posição ainda vazia na tela não diverge).
 */
export function divergenciasPapeleta(
  papeleta: Pick<PapeletaBanco, 'formacao' | 'liberoId'>,
  escalacao: { formacao: Array<ItemFormacao | null>; liberoId: number | null } | null,
): Divergencia[] {
  if (!escalacao) return []
  const saida: Divergencia[] = []
  for (const item of papeleta.formacao) {
    const naTela = escalacao.formacao.find((f) => f && f.posicao === item.posicao)?.jogadorId ?? null
    if (naTela != null && naTela !== item.jogadorId) {
      saida.push({ tipo: 'POSICAO', posicao: item.posicao, papeleta: item.jogadorId, escalacao: naTela })
    }
  }
  if (escalacao.liberoId != null && papeleta.liberoId != null && escalacao.liberoId !== papeleta.liberoId) {
    saida.push({ tipo: 'LIBERO', papeleta: papeleta.liberoId, escalacao: escalacao.liberoId })
  }
  return saida
}

/** Papeleta aplicável: 6 posições distintas (1 a 6) e 6 atletas distintos. */
export function formacaoAplicavel(formacao: ItemFormacao[]): boolean {
  if (formacao.length !== 6) return false
  const posicoes = new Set(formacao.map((f) => f.posicao))
  const atletas = new Set(formacao.map((f) => f.jogadorId))
  return posicoes.size === 6 && atletas.size === 6 && Array.from(posicoes).every((p) => p >= 1 && p <= 6)
}

/** Converte a formação em ids por índice da quadra (posição 1 = índice 0). */
export function idsPorIndice(formacao: ItemFormacao[]): number[] {
  const saida: number[] = [0, 0, 0, 0, 0, 0]
  for (const item of formacao) saida[item.posicao - 1] = item.jogadorId
  return saida
}

export function mensagemDivergencia(d: Divergencia, rotulo: RotuloJogador): string {
  const a = d.papeleta != null ? rotulo(d.papeleta) ?? `atleta ${d.papeleta}` : 'ninguém'
  const b = d.escalacao != null ? rotulo(d.escalacao) ?? `atleta ${d.escalacao}` : 'ninguém'
  return d.tipo === 'LIBERO' ? `Líbero: banco ${a}, tela ${b}` : `Posição ${d.posicao}: banco ${a}, tela ${b}`
}

/** Link do WhatsApp com o endereço do banco. */
export function linkWhatsapp(url: string, nomeEquipe: string): string {
  const texto = `Banco de reservas de ${nomeEquipe} no volei.space: ${url}`
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

/**
 * Envelope {data}/{error, codigo}. 404/503 SEM `codigo` do servidor = recurso desligado.
 * Com `codigo` (ex.: PEDIDO_NAO_ENCONTRADO, BANCO_INDISPONIVEL) é um erro real, com a mensagem do servidor.
 */
export type RespostaEnvelope<T> =
  | { tipo: 'ok'; data: T }
  | { tipo: 'desligado' }
  | { tipo: 'erro'; mensagem: string; status: number; codigo?: string }

export async function lerEnvelope<T>(resposta: { ok: boolean; status: number; json: () => Promise<unknown> }): Promise<RespostaEnvelope<T>> {
  let corpo: { data?: T; error?: unknown; codigo?: unknown } | null = null
  try {
    corpo = (await resposta.json()) as { data?: T; error?: unknown; codigo?: unknown } | null
  } catch {
    corpo = null
  }
  const codigo = typeof corpo?.codigo === 'string' && corpo.codigo !== '' ? corpo.codigo : undefined
  if ((resposta.status === 404 || resposta.status === 503) && !codigo) return { tipo: 'desligado' }
  if (resposta.ok && corpo && corpo.data !== undefined) return { tipo: 'ok', data: corpo.data }
  const erro = corpo?.error
  const mensagem = typeof erro === 'string'
    ? erro
    : erro && typeof erro === 'object' && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : 'Não foi possível concluir. Tente de novo.'
  return { tipo: 'erro', mensagem, status: resposta.status, ...(codigo ? { codigo } : {}) }
}

/**
 * Aviso ao apontador quando o servidor recusa a decisão DEPOIS de a tela já ter registrado a ação.
 * Tempo/troca: o registro na súmula já valeu; desafio: o servidor é quem cria o desafio (não houve registro na súmula).
 */
export function mensagemFalhaDecisao(params: { decisao: 'ACEITO' | 'RECUSADO'; tipo: TipoPedidoBanco; status?: number | null; mensagem: string }): string {
  const { decisao, tipo, status, mensagem } = params
  if (decisao === 'RECUSADO') return `Não foi possível enviar a recusa: ${mensagem}`
  if (tipo === 'DESAFIO') return `Não foi possível aceitar o desafio: ${mensagem}`
  const nome = tipo === 'TEMPO' ? 'O tempo' : 'A troca'
  const registrado = tipo === 'TEMPO' ? 'registrado' : 'registrada'
  if (status === 422) {
    return `${nome} já foi ${registrado} na súmula, mas o servidor recusou a resposta ao banco (${mensagem}). Confira o registro na súmula e avise o banco; o pedido pode continuar pendente.`
  }
  return `${nome} foi ${registrado} na súmula, mas o banco não recebeu a resposta (${mensagem}). Avise o banco e tente responder de novo só se precisar.`
}
