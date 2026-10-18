/** Classificação das respostas do servidor para as telas de estado do app do banco. Módulo PURO. */

export type TelaEstado = 'desligado' | 'nao-habilitado' | 'token-invalido' | 'sessao' | 'expirado' | 'rede' | 'limite' | 'erro'

/** Destino do botão da tela de sessão (entrar de novo no Meu Time). */
export const DESTINO_SESSAO = '/login'

/** 429: o servidor limitou as consultas; não é erro do usuário nem falta de internet. */
export const MENSAGEM_LIMITE = 'Muitas consultas, aguardando. Tentamos de novo em instantes.'

/** `porSessao`: o banco foi aberto pelo Meu Time (sem token no link). Nesse caso 400/401/403 falam de sessão, não de link. */
export function classificarFalha(status: number | null, porSessao = false): TelaEstado {
  if (status === null) return 'rede'
  if (status === 429) return 'limite'
  if (status === 404) return 'desligado'
  if (status === 503) return 'nao-habilitado'
  if (status === 410) return 'expirado'
  if (status === 400 || status === 401 || status === 403) return porSessao ? 'sessao' : 'token-invalido'
  return 'erro'
}

export const TEXTO_TELA: Readonly<Record<TelaEstado, { titulo: string; texto: string; tentar: boolean }>> = {
  desligado: { titulo: 'App do banco indisponível', texto: 'Este recurso não está ativo para este jogo, ou o link não existe. Confira o link com o organizador.', tentar: false },
  'nao-habilitado': { titulo: 'Ainda não habilitado', texto: 'O app do banco ainda não foi habilitado para este jogo. Tente de novo mais tarde ou fale com o organizador.', tentar: true },
  'token-invalido': { titulo: 'Link inválido', texto: 'Este link não é válido. Peça um novo link ao organizador ou ao apontador.', tentar: false },
  sessao: { titulo: 'Sessão expirada', texto: 'Sua sessão expirou ou você não tem acesso a este jogo. Entre de novo no Meu Time.', tentar: false },
  expirado: { titulo: 'Link expirado', texto: 'Este link expirou ou foi revogado. Peça um novo link ao organizador ou ao apontador.', tentar: false },
  rede: { titulo: 'Sem conexão', texto: 'Não foi possível falar com o servidor. Verifique sua internet.', tentar: true },
  limite: { titulo: 'Muitas consultas, aguardando', texto: 'O servidor pediu uma pausa. Vamos tentar de novo sozinhos, com um intervalo maior a cada vez.', tentar: true },
  erro: { titulo: 'Algo deu errado', texto: 'Não foi possível carregar agora. Tente novamente.', tentar: true },
}

/** Extrai violações {codigo, mensagem} de diferentes formatos de envelope de erro. */
export function extrairViolacoes(json: unknown): { codigo: string; mensagem: string }[] {
  const raiz = (json ?? {}) as Record<string, unknown>
  const candidatos: unknown[] = [
    raiz.violacoes,
    (raiz.data as Record<string, unknown> | undefined)?.violacoes,
    (raiz.error as Record<string, unknown> | undefined)?.violacoes,
  ]
  for (const c of candidatos) {
    if (Array.isArray(c)) {
      return c
        .map((v) => v as Record<string, unknown>)
        .filter((v) => v && typeof v.mensagem === 'string')
        .map((v) => ({ codigo: typeof v.codigo === 'string' ? v.codigo : 'RG', mensagem: String(v.mensagem) }))
    }
  }
  return []
}

export function mensagemDeErro(json: unknown, padrao: string): string {
  const raiz = (json ?? {}) as Record<string, unknown>
  if (typeof raiz.error === 'string' && raiz.error.trim()) return raiz.error
  const e = raiz.error as Record<string, unknown> | undefined
  if (e && typeof e.mensagem === 'string') return e.mensagem
  if (e && typeof e.message === 'string') return e.message
  return padrao
}

/** Nome de um lado da partida (aceita string ou objeto com nome). */
export function nomeDoLado(lado: unknown): string {
  if (typeof lado === 'string') return lado
  if (lado && typeof lado === 'object' && typeof (lado as { nome?: unknown }).nome === 'string') return (lado as { nome: string }).nome
  return 'Equipe'
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Placar legível a partir de formatos prováveis; null se não reconhecer. */
export function formatarPlacar(placar: unknown): { sets: string | null; pontos: string | null } | null {
  if (placar === null || placar === undefined) return null
  if (typeof placar === 'string') return placar.trim() ? { sets: null, pontos: placar } : null
  if (typeof placar !== 'object') return null
  const p = placar as Record<string, unknown>
  const par = (o: unknown, ka: string, kb: string): string | null => {
    const r = (o ?? {}) as Record<string, unknown>
    const a = num(r[ka])
    const b = num(r[kb])
    return a !== null && b !== null ? `${a} x ${b}` : null
  }
  const sets = par(p, 'setsA', 'setsB') ?? par(p.sets, 'a', 'b') ?? par(p, 'setsEquipeA', 'setsEquipeB')
  const pontos = par(p, 'pontosA', 'pontosB') ?? par(p.pontos, 'a', 'b') ?? par(p, 'a', 'b') ?? par(p, 'pontosEquipeA', 'pontosEquipeB')
  return sets || pontos ? { sets, pontos } : null
}
