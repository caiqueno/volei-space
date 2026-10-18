/**
 * Lógica pura do desafio de vídeo (vôlei de quadra). Sem React e sem rede.
 * O servidor é a autoridade: saldo e limites aqui são só informação para a tela.
 */

export type EstadoDesafio = 'SOLICITADO' | 'EM_ANALISE' | 'MANTIDA' | 'REVERTIDA' | 'CANCELADO' | 'INCONCLUSIVA'
export type DecisaoDesafio = 'MANTIDA' | 'REVERTIDA' | 'CANCELADO' | 'INCONCLUSIVA'

export interface Desafio {
  id: number | string
  setNumero: number
  equipeId: number
  estado: EstadoDesafio
  motivo: string | null
  linkVideo: string | null
  solicitadoEm: string | null
  decididoEm: string | null
}

export const MOTIVO_MAX = 200
export const LINK_MAX = 500

/** A tela só liga com a flag exatamente '1'. */
export function desafioAtivo(valor: string | undefined | null): boolean {
  return valor === '1'
}

export const ROTULO_ESTADO_DESAFIO: Readonly<Record<EstadoDesafio, string>> = {
  SOLICITADO: 'Solicitado',
  EM_ANALISE: 'Em análise',
  MANTIDA: 'Decisão mantida',
  REVERTIDA: 'Decisão revertida',
  CANCELADO: 'Cancelado',
  INCONCLUSIVA: 'Inconclusiva (não consome)',
}

export const ICONE_ESTADO_DESAFIO: Readonly<Record<EstadoDesafio, string>> = {
  SOLICITADO: '⏳',
  EM_ANALISE: '🔍',
  MANTIDA: '✔',
  REVERTIDA: '↺',
  CANCELADO: '–',
  INCONCLUSIVA: '≈',
}

export function textoEstadoDesafio(estado: string): string {
  return ROTULO_ESTADO_DESAFIO[estado as EstadoDesafio] ?? 'Estado desconhecido'
}

export function iconeEstadoDesafio(estado: string): string {
  return ICONE_ESTADO_DESAFIO[estado as EstadoDesafio] ?? '?'
}

/** Desafio ainda aguardando decisão do apontador. */
export function desafioAberto(d: Pick<Desafio, 'estado'>): boolean {
  return d.estado === 'SOLICITADO' || d.estado === 'EM_ANALISE'
}

const MSG_LINK = 'Link de vídeo inválido. Use um endereço começando com http:// ou https://.'

/** Aceita só http/https. Vazio é válido (campo opcional). Devolve o link normalizado ou a mensagem de erro. */
export function validarLinkVideo(entrada: string | null | undefined): { ok: true; link: string | null } | { ok: false; mensagem: string } {
  const texto = (entrada ?? '').trim()
  if (texto === '') return { ok: true, link: null }
  if (texto.length > LINK_MAX) return { ok: false, mensagem: `O link deve ter no máximo ${LINK_MAX} caracteres.` }
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return { ok: false, mensagem: MSG_LINK }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, mensagem: MSG_LINK }
  return { ok: true, link: texto }
}

export function validarMotivo(entrada: string | null | undefined): { ok: true; motivo: string | null } | { ok: false; mensagem: string } {
  const texto = (entrada ?? '').trim()
  if (texto.length > MOTIVO_MAX) return { ok: false, mensagem: `O motivo deve ter no máximo ${MOTIVO_MAX} caracteres.` }
  return { ok: true, motivo: texto === '' ? null : texto }
}

export type ResultadoCorpo =
  | { ok: true; corpo: { setNumero: number; equipeId: number; motivo?: string; linkVideo?: string } }
  | { ok: false; mensagem: string }

export function montarCorpoDesafio(params: { setNumero: number; equipeId: number | null; motivo: string; linkVideo: string }): ResultadoCorpo {
  if (!Number.isInteger(params.setNumero) || params.setNumero < 1) return { ok: false, mensagem: 'Set inválido.' }
  if (params.equipeId == null) return { ok: false, mensagem: 'Escolha a equipe que pediu o desafio.' }
  const m = validarMotivo(params.motivo)
  if (!m.ok) return m
  const l = validarLinkVideo(params.linkVideo)
  if (!l.ok) return l
  const corpo: { setNumero: number; equipeId: number; motivo?: string; linkVideo?: string } = { setNumero: params.setNumero, equipeId: params.equipeId }
  if (m.motivo) corpo.motivo = m.motivo
  if (l.link) corpo.linkVideo = l.link
  return { ok: true, corpo }
}

/** Agrupa por set (crescente); dentro do set, mais recentes primeiro. */
export function agruparPorSet(desafios: readonly Desafio[]): Array<{ setNumero: number; itens: Desafio[] }> {
  const mapa = new Map<number, Desafio[]>()
  for (const d of desafios) {
    const lista = mapa.get(d.setNumero) ?? []
    lista.push(d)
    mapa.set(d.setNumero, lista)
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([setNumero, itens]) => ({
      setNumero,
      itens: [...itens].sort((x, y) => String(y.solicitadoEm ?? '').localeCompare(String(x.solicitadoEm ?? ''))),
    }))
}

/**
 * Desafios por equipe no set (não conta os cancelados). Informativo: o servidor decide o limite de fato;
 * `limite` é opcional porque a tela pode não conhecê-lo.
 */
export function saldoDesafios(
  desafios: readonly Desafio[],
  equipeId: number,
  setNumero: number,
  limite?: number,
): { usados: number; limite: number | null; restantes: number | null } {
  const usados = desafios.filter((d) => d.equipeId === equipeId && d.setNumero === setNumero && d.estado !== 'CANCELADO').length
  if (limite == null) return { usados, limite: null, restantes: null }
  return { usados, limite, restantes: Math.max(0, limite - usados) }
}

export function textoSaldo(s: { usados: number; limite: number | null; restantes: number | null }): string {
  if (s.limite == null) return `${s.usados} ${s.usados === 1 ? 'desafio usado' : 'desafios usados'} neste set`
  return `${s.usados} de ${s.limite} usados neste set (restam ${s.restantes})`
}

export function textoDecisao(decisao: DecisaoDesafio): string {
  if (decisao === 'MANTIDA') return 'Manter a decisão do árbitro'
  if (decisao === 'REVERTIDA') return 'Reverter a decisão do árbitro'
  if (decisao === 'INCONCLUSIVA') return 'Marcar como inconclusivo (não consome o desafio da equipe)'
  return 'Cancelar o desafio'
}

/** O desafio de vídeo só vale em competições que usam sistema de vídeo. */
export const TEXTO_SISTEMA_VIDEO = 'O desafio de vídeo só vale em competições com sistema de vídeo. Se a sua competição não usa, não registre desafios.'

/** Link seguro para o <a href>: reaplica a validação (só http/https) mesmo para dados vindos do servidor. */
export function linkVideoSeguro(entrada: string | null | undefined): string | null {
  const r = validarLinkVideo(entrada)
  return r.ok ? r.link : null
}

/** Botões de decisão só em desafio aberto e sem requisição em voo. */
export function podeDecidir(d: Pick<Desafio, 'estado'>, decidindo: boolean): boolean {
  return desafioAberto(d) && !decidindo
}

export function podeRegistrar(params: { partidaEmAndamento: boolean; enviando: boolean }): { ok: true } | { ok: false; motivo: string } {
  if (params.enviando) return { ok: false, motivo: 'Enviando...' }
  if (!params.partidaEmAndamento) return { ok: false, motivo: 'O desafio só pode ser registrado com a partida em andamento.' }
  return { ok: true }
}

export type RespostaDesafios<T> = { tipo: 'ok'; data: T } | { tipo: 'desligado' } | { tipo: 'erro'; mensagem: string; status: number; codigo?: string }

/** Lê o envelope {data}/{error, codigo}; 404/503 SEM `codigo` do servidor = recurso desligado. Com `codigo` é erro real. */
export async function lerRespostaDesafio<T>(resposta: { ok: boolean; status: number; json: () => Promise<unknown> }): Promise<RespostaDesafios<T>> {
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
  const mensagem =
    typeof erro === 'string' ? erro : erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : 'Não foi possível concluir. Tente de novo.'
  return { tipo: 'erro', mensagem, status: resposta.status, ...(codigo ? { codigo } : {}) }
}

/** Normaliza a lista vinda do servidor, descartando itens malformados. */
export function normalizarDesafios(bruto: unknown): Desafio[] {
  if (!Array.isArray(bruto)) return []
  const saida: Desafio[] = []
  for (const x of bruto) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if ((typeof o.id !== 'number' && typeof o.id !== 'string') || typeof o.setNumero !== 'number' || typeof o.equipeId !== 'number') continue
    saida.push({
      id: o.id,
      setNumero: o.setNumero,
      equipeId: o.equipeId,
      estado: String(o.estado) as EstadoDesafio,
      motivo: typeof o.motivo === 'string' ? o.motivo : null,
      linkVideo: typeof o.linkVideo === 'string' ? o.linkVideo : null,
      solicitadoEm: typeof o.solicitadoEm === 'string' ? o.solicitadoEm : null,
      decididoEm: typeof o.decididoEm === 'string' ? o.decididoEm : null,
    })
  }
  return saida
}
