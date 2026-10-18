/**
 * Desafio de vídeo (R11): regras puras (sem I/O). Atrás da flag DESAFIO_ATIVO.
 *
 * NÃO CONFIRMADO ([M]): o limite de desafios por equipe por set é CONFIGURÁVEL. O padrão 2 é uma
 * suposição de produto, não regra oficial. A convenção de contagem abaixo (desafio revertido é
 * devolvido à equipe e não conta) segue a prática comum de regulamentos com vídeo e também precisa
 * de confirmação. Ver docs/analise/27-desafio-video.md.
 */

export const ESTADOS_DESAFIO = ['SOLICITADO', 'EM_ANALISE', 'MANTIDA', 'REVERTIDA', 'INCONCLUSIVA', 'CANCELADO'] as const
export type EstadoDesafio = (typeof ESTADOS_DESAFIO)[number]

/** Decisões que o apontador pode registrar. */
export const DECISOES_DESAFIO = ['MANTIDA', 'REVERTIDA', 'INCONCLUSIVA', 'CANCELADO'] as const
export type DecisaoDesafio = (typeof DECISOES_DESAFIO)[number]

/** [M] Padrão não confirmado. Configurável por `DESAFIO_LIMITE_POR_SET` (1 a 10). */
export const LIMITE_DESAFIOS_POR_SET_PADRAO = 2
export const MAX_MOTIVO = 300
export const MAX_LINK_VIDEO = 500

export const MENSAGEM_DESAFIO_INDISPONIVEL = 'Recurso ainda não habilitado neste ambiente.'

export function desafioAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.DESAFIO_ATIVO === '1'
}

export function limiteDesafiosPorSet(env: Record<string, string | undefined> = process.env): number {
  const bruto = env.DESAFIO_LIMITE_POR_SET
  if (bruto != null && /^\d+$/.test(bruto.trim())) {
    const n = Number(bruto)
    if (n >= 1 && n <= 10) return n
  }
  return LIMITE_DESAFIOS_POR_SET_PADRAO
}

/**
 * O desafio consome o limite da equipe? SOLICITADO, EM_ANALISE e MANTIDA contam.
 * REVERTIDA (a equipe tinha razão) e INCONCLUSIVA (o vídeo não permitiu decidir) devolvem o desafio; CANCELADO nunca foi analisado.
 */
export function contaNoLimite(estado: string): boolean {
  return estado === 'SOLICITADO' || estado === 'EM_ANALISE' || estado === 'MANTIDA'
}

export function desafiosUsados(linhas: ReadonlyArray<{ estado?: unknown }>): number {
  return linhas.filter((l) => contaNoLimite(String(l.estado))).length
}

export function estadoFinal(estado: string): boolean {
  return estado === 'MANTIDA' || estado === 'REVERTIDA' || estado === 'INCONCLUSIVA' || estado === 'CANCELADO'
}

/**
 * Decisão sobre um desafio no estado atual:
 *  - APLICAR: ainda aberto (SOLICITADO/EM_ANALISE);
 *  - IDEMPOTENTE: já está exatamente na decisão pedida;
 *  - CONFLITO: já foi decidido de outra forma (409).
 */
export function resolverDecisao(estadoAtual: string, decisao: DecisaoDesafio): 'APLICAR' | 'IDEMPOTENTE' | 'CONFLITO' {
  if (estadoAtual === decisao) return 'IDEMPOTENTE'
  if (estadoFinal(estadoAtual)) return 'CONFLITO'
  return 'APLICAR'
}

export type ResultadoLink = { ok: true; valor: string | null } | { ok: false; mensagem: string }

/** Link do vídeo: só http(s), sem credenciais na URL, até 500 caracteres. Vazio vira null. */
export function validarLinkVideo(valor: unknown): ResultadoLink {
  if (valor == null) return { ok: true, valor: null }
  if (typeof valor !== 'string') return { ok: false, mensagem: 'linkVideo deve ser um texto.' }
  const texto = valor.trim()
  if (texto === '') return { ok: true, valor: null }
  if (texto.length > MAX_LINK_VIDEO) return { ok: false, mensagem: `linkVideo deve ter no máximo ${MAX_LINK_VIDEO} caracteres.` }
  if (/[\s\u0000-\u001f]/.test(texto)) return { ok: false, mensagem: 'linkVideo não pode ter espaços nem caracteres de controle.' }
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return { ok: false, mensagem: 'linkVideo deve ser uma URL válida.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, mensagem: 'linkVideo deve começar com http:// ou https://.' }
  if (url.username || url.password) return { ok: false, mensagem: 'linkVideo não pode conter usuário ou senha na URL.' }
  if (!url.hostname) return { ok: false, mensagem: 'linkVideo deve ser uma URL válida.' }
  return { ok: true, valor: texto }
}

export function normalizarMotivo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t === '' ? null : t
}
