/**
 * Agregação de AcaoScout por jogador, equipe e set. Função pura.
 *
 * Convenções (PROPOSTAS, ainda sem validação do produto; ver docs/analise/26-scout.md):
 *  - Eficiência de ataque = (pontos - erros) / tentativas, com ATAQUE e CONTRA_ATAQUE somados.
 *  - Recepção positiva = recepções com resultado PONTO ou CONTINUA / total de recepções.
 *    (PONTO = recepção perfeita, CONTINUA = recepção que permitiu o ataque, NEUTRO = regular/ruim, ERRO = ace do adversário.)
 *  - Eficiência de saque = (aces - erros) / saques. Ace = SAQUE com PONTO; erro = SAQUE com ERRO.
 *  - Bloqueios = BLOQUEIO com PONTO.
 * Razões sem denominador viram null (nunca 0, para não confundir "sem dado" com "zero").
 */
import { FUNDAMENTOS, type AcaoScout, type EquipeScout, type Fundamento, type ResultadoAcao } from './modelo'

export type ContagemResultados = Record<ResultadoAcao, number> & { total: number }

export interface EstatisticasScout {
  porFundamento: Record<Fundamento, ContagemResultados>
  ataque: { tentativas: number; pontos: number; erros: number; eficiencia: number | null }
  recepcao: { total: number; positivas: number; percentualPositiva: number | null }
  saque: { total: number; aces: number; erros: number; eficiencia: number | null }
  aces: number
  /** Erros de qualquer fundamento. */
  erros: number
  bloqueios: number
  /** Ações lançadas (qualquer fundamento). */
  acoes: number
}

export interface EstatisticasJogador extends EstatisticasScout {
  equipe: EquipeScout
  jogadorId: number | null
}

export interface EstatisticasPorEquipe extends EstatisticasScout {
  equipe: EquipeScout
}

export interface EstatisticasPorSet extends EstatisticasScout {
  set: number
  equipe: EquipeScout
}

export interface AgregacaoScout {
  porJogador: EstatisticasJogador[]
  porEquipe: EstatisticasPorEquipe[]
  porSet: EstatisticasPorSet[]
}

function contagemVazia(): ContagemResultados {
  return { PONTO: 0, ERRO: 0, CONTINUA: 0, NEUTRO: 0, total: 0 }
}

function razao(n: number, d: number): number | null {
  return d > 0 ? n / d : null
}

/** Arredonda razões a 4 casas para saída estável (sem 0.1+0.2). */
function arred(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10000) / 10000
}

export function estatisticasDe(acoes: readonly AcaoScout[]): EstatisticasScout {
  const porFundamento = Object.fromEntries(FUNDAMENTOS.map((f) => [f, contagemVazia()])) as Record<Fundamento, ContagemResultados>
  for (const a of acoes) {
    const c = porFundamento[a.fundamento]
    c[a.resultado] += 1
    c.total += 1
  }
  const atq = { PONTO: 0, ERRO: 0, total: 0 }
  for (const f of ['ATAQUE', 'CONTRA_ATAQUE'] as const) {
    atq.PONTO += porFundamento[f].PONTO
    atq.ERRO += porFundamento[f].ERRO
    atq.total += porFundamento[f].total
  }
  const rec = porFundamento.RECEPCAO
  const sq = porFundamento.SAQUE
  const erros = FUNDAMENTOS.reduce((s, f) => s + porFundamento[f].ERRO, 0)
  return {
    porFundamento,
    ataque: { tentativas: atq.total, pontos: atq.PONTO, erros: atq.ERRO, eficiencia: arred(razao(atq.PONTO - atq.ERRO, atq.total)) },
    recepcao: { total: rec.total, positivas: rec.PONTO + rec.CONTINUA, percentualPositiva: arred(razao(rec.PONTO + rec.CONTINUA, rec.total)) },
    saque: { total: sq.total, aces: sq.PONTO, erros: sq.ERRO, eficiencia: arred(razao(sq.PONTO - sq.ERRO, sq.total)) },
    aces: sq.PONTO,
    erros,
    bloqueios: porFundamento.BLOQUEIO.PONTO,
    acoes: acoes.length,
  }
}

function agrupar<T>(acoes: readonly AcaoScout[], chave: (a: AcaoScout) => string, montar: (grupo: AcaoScout[]) => T): T[] {
  const mapa = new Map<string, AcaoScout[]>()
  for (const a of acoes) {
    const k = chave(a)
    const g = mapa.get(k)
    if (g) g.push(a)
    else mapa.set(k, [a])
  }
  return Array.from(mapa.entries()).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([, g]) => montar(g))
}

export function agregarAcoes(acoes: readonly AcaoScout[]): AgregacaoScout {
  return {
    porJogador: agrupar(
      acoes,
      (a) => `${a.equipe}:${String(a.jogadorId ?? 0).padStart(12, '0')}`,
      (g) => ({ equipe: g[0]!.equipe, jogadorId: g[0]!.jogadorId, ...estatisticasDe(g) }),
    ),
    porEquipe: agrupar(acoes, (a) => a.equipe, (g) => ({ equipe: g[0]!.equipe, ...estatisticasDe(g) })),
    porSet: agrupar(
      acoes,
      (a) => `${String(a.set).padStart(3, '0')}:${a.equipe}`,
      (g) => ({ set: g[0]!.set, equipe: g[0]!.equipe, ...estatisticasDe(g) }),
    ),
  }
}
