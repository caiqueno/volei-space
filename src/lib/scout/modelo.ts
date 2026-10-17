/**
 * Modelo de dados do scout (TS puro, sem I/O). Rodada 10.
 *
 * Uma AcaoScout é um toque/lance por fundamento. O log de eventos do motor NÃO traz ações
 * (só quem ganhou o rally), então as ações vêm do lançamento manual (R11, tabela "ScoutAcao", ver `acoes.ts`).
 * O modelo fica pronto para isso; a derivação do log fica em `derivacao.ts`.
 * Ver docs/analise/26-scout.md.
 */

export const VERSAO_ESQUEMA_JSON = 'scout-json-2'
export const VERSAO_ESQUEMA_CSV = 'scout-csv-2'

export const FUNDAMENTOS = ['SAQUE', 'RECEPCAO', 'LEVANTAMENTO', 'ATAQUE', 'BLOQUEIO', 'DEFESA', 'CONTRA_ATAQUE'] as const
export type Fundamento = (typeof FUNDAMENTOS)[number]

/** PONTO = fez o ponto; ERRO = deu o ponto ao adversário; CONTINUA = jogo segue; NEUTRO = sem qualificação. */
export const RESULTADOS = ['PONTO', 'ERRO', 'CONTINUA', 'NEUTRO'] as const
export type ResultadoAcao = (typeof RESULTADOS)[number]

export type EquipeScout = 'A' | 'B'
/** Zonas da quadra, 1 a 9 (convenção de scout; a numeração exata ainda precisa de confirmação). */
export type Zona = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface AcaoScout {
  /** Identificador estável dentro da partida (ordem de lançamento). */
  id: number
  set: number
  /** Placar do set ANTES da ação. */
  pontoA: number
  pontoB: number
  equipe: EquipeScout
  /** id do jogador; null = desconhecido. Nunca nome (LGPD). */
  jogadorId: number | null
  fundamento: Fundamento
  resultado: ResultadoAcao
  /** Rotação da equipe (1 a 6, relativa à formação inicial do set); null = desconhecida. */
  rotacao: number | null
  /** Posição do jogador na quadra (1 a 6); null = desconhecida. */
  posicao: number | null
  zonaOrigem: Zona | null
  zonaDestino: Zona | null
  /** MANUAL = lançada por scout. DERIVADA reservada: hoje a derivação não gera AcaoScout. */
  origem: 'MANUAL' | 'DERIVADA'
  /** Hora de gravação da ação manual (ISO); ausente em ação derivada. */
  criadoEm?: string | null
}

function inteiroEm(valor: unknown, min: number, max: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max
}

/** Valida uma ação; devolve a lista de problemas (vazia = válida). */
export function validarAcao(a: Partial<AcaoScout> | null | undefined): string[] {
  const erros: string[] = []
  if (!a || typeof a !== 'object') return ['Ação inválida.']
  if (!inteiroEm(a.id, 1, Number.MAX_SAFE_INTEGER)) erros.push('id deve ser inteiro positivo.')
  if (!inteiroEm(a.set, 1, 5)) erros.push('set deve estar entre 1 e 5.')
  if (!inteiroEm(a.pontoA, 0, 999) || !inteiroEm(a.pontoB, 0, 999)) erros.push('pontoA e pontoB devem ser inteiros >= 0.')
  if (a.equipe !== 'A' && a.equipe !== 'B') erros.push('equipe deve ser A ou B.')
  if (a.jogadorId != null && !inteiroEm(a.jogadorId, 1, Number.MAX_SAFE_INTEGER)) erros.push('jogadorId deve ser inteiro positivo ou null.')
  if (!FUNDAMENTOS.includes(a.fundamento as Fundamento)) erros.push('fundamento desconhecido.')
  if (!RESULTADOS.includes(a.resultado as ResultadoAcao)) erros.push('resultado desconhecido.')
  if (a.rotacao != null && !inteiroEm(a.rotacao, 1, 6)) erros.push('rotacao deve estar entre 1 e 6.')
  if (a.posicao != null && !inteiroEm(a.posicao, 1, 6)) erros.push('posicao deve estar entre 1 e 6.')
  if (a.zonaOrigem != null && !inteiroEm(a.zonaOrigem, 1, 9)) erros.push('zonaOrigem deve estar entre 1 e 9.')
  if (a.zonaDestino != null && !inteiroEm(a.zonaDestino, 1, 9)) erros.push('zonaDestino deve estar entre 1 e 9.')
  if (a.origem !== 'MANUAL' && a.origem !== 'DERIVADA') erros.push('origem deve ser MANUAL ou DERIVADA.')
  return erros
}
