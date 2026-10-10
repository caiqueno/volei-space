import { ehPontoSemJogador } from '@/lib/ponto-sumula'

/** A aba aberta relê neste intervalo. O cache da rota é mais curto para a próxima leitura não repetir o mesmo resultado. */
export const INTERVALO_RANKING_JOGADORES_MS = 12_000
export const CACHE_RANKING_JOGADORES_MS = 8_000

export type FundamentoId = 'ataque' | 'bloqueio' | 'saque' | 'ponto'

export type AtletaRanking = {
  id: number
  nome: string
  equipe: string
}

export type LanceRanking = {
  tipo: string
  jogadorId: number | null
  descricao?: string | null
  campeonatoExiste: boolean
}

export type ColunaFundamento = {
  id: string
  rotulo: string
}

export type LinhaJogadorRanking = {
  posicao: number
  jogadorId: number
  nome: string
  equipe: string
  fundamentos: Record<string, number>
  total: number
}

export type ClassificacaoJogadores = {
  fundamentos: ColunaFundamento[]
  jogadores: LinhaJogadorRanking[]
}

const ROTULO: Record<string, string> = {
  ataque: 'Ataque',
  bloqueio: 'Bloqueio',
  saque: 'Saque',
  ponto: 'Ponto',
}

const POR_TIPO: Record<string, FundamentoId> = {
  ace: 'saque',
  saque: 'saque',
  attack: 'ataque',
  ataque: 'ataque',
  block: 'bloqueio',
  bloqueio: 'bloqueio',
  point: 'ponto',
  ponto: 'ponto',
}

/** Valores de `OcorrenciaPartida.tipo` que a leitura pede. O cálculo também aceita a forma minúscula. */
export const TIPOS_FUNDAMENTO_CONSULTA = [
  'ace', 'ACE', 'saque', 'SAQUE',
  'attack', 'ATAQUE', 'ataque',
  'block', 'BLOQUEIO', 'bloqueio',
  'point', 'POINT', 'ponto', 'PONTO',
]

const COLUNAS_FIXAS: FundamentoId[] = ['ataque', 'bloqueio', 'saque']

function semAcento(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function corpoDoLance(descricao: string) {
  const partes = descricao.split('|')
  if (partes.length < 3) return descricao.trim()
  return partes.slice(2).join('|').trim()
}

/** Lance que a súmula já tirou ou que nunca foi ponto de atleta. */
export function lanceForaDoRanking(descricao: string | null | undefined) {
  const texto = String(descricao ?? '').trim()
  if (!texto) return false
  const corpo = corpoDoLance(texto)
  if (ehPontoSemJogador(texto) || ehPontoSemJogador(corpo)) return true
  const normal = semAcento(corpo)
  if (normal.startsWith('registro de ')) return true
  return /\bdesfeit|\banulad|\bexcluido\b|\bdesconsider/.test(normal)
}

function fundamentoNoTexto(descricao: string): FundamentoId | null {
  const texto = semAcento(descricao)
  if (/\bpontos? de ataque\b|\bataque para\b/.test(texto)) return 'ataque'
  if (/\bpontos? de bloqueio\b|\bbloqueio para\b/.test(texto)) return 'bloqueio'
  if (/\bpontos? de saque\b|\bace para\b|\bace\b/.test(texto)) return 'saque'
  return null
}

/**
 * Ataque, bloqueio e saque (ace) saem do `tipo` da ocorrência.
 * `point`/`ponto` com atleta vira Ponto, ou o fundamento escrito no texto.
 * Cartão, tempo, substituição, anotação e registro de camisa não entram.
 */
export function fundamentoDoLance(lance: LanceRanking): string | null {
  if (!lance.campeonatoExiste) return null
  if (lance.jogadorId == null) return null
  if (lanceForaDoRanking(lance.descricao)) return null
  const tipo = String(lance.tipo ?? '').trim().toLowerCase()
  const peloTipo = POR_TIPO[tipo]
  if (!peloTipo) return null
  if (peloTipo === 'ponto') return fundamentoNoTexto(String(lance.descricao ?? '')) ?? 'ponto'
  return peloTipo
}

export function compararRanking(a: LinhaJogadorRanking, b: LinhaJogadorRanking) {
  return b.total - a.total
    || (b.fundamentos.ataque ?? 0) - (a.fundamentos.ataque ?? 0)
    || (b.fundamentos.bloqueio ?? 0) - (a.fundamentos.bloqueio ?? 0)
    || (b.fundamentos.saque ?? 0) - (a.fundamentos.saque ?? 0)
    || a.nome.localeCompare(b.nome, 'pt')
}

export function classificarJogadores(atletas: AtletaRanking[], lances: LanceRanking[]): ClassificacaoJogadores {
  const porId = new Map<number, { nome: string; equipe: string; fundamentos: Record<string, number>; total: number }>()
  for (const atleta of atletas) {
    if (!Number.isInteger(atleta.id)) continue
    porId.set(atleta.id, {
      nome: atleta.nome.trim() || 'Atleta',
      equipe: atleta.equipe.trim() || 'Equipe',
      fundamentos: {},
      total: 0,
    })
  }

  const extras = new Set<string>()
  for (const lance of lances) {
    const fundamento = fundamentoDoLance(lance)
    if (!fundamento || lance.jogadorId == null) continue
    const linha = porId.get(lance.jogadorId)
    if (!linha) continue
    linha.fundamentos[fundamento] = (linha.fundamentos[fundamento] ?? 0) + 1
    linha.total += 1
    if (!COLUNAS_FIXAS.includes(fundamento as FundamentoId)) extras.add(fundamento)
  }
  const colunasExtras = Array.from(extras).sort()

  const jogadores = Array.from(porId.entries()).map(([jogadorId, linha]) => {
    const fundamentos: Record<string, number> = {
      ataque: linha.fundamentos.ataque ?? 0,
      bloqueio: linha.fundamentos.bloqueio ?? 0,
      saque: linha.fundamentos.saque ?? 0,
    }
    for (const extra of colunasExtras) fundamentos[extra] = linha.fundamentos[extra] ?? 0
    return {
      posicao: 0,
      jogadorId,
      nome: linha.nome,
      equipe: linha.equipe,
      fundamentos,
      total: linha.total,
    }
  })
  jogadores.sort(compararRanking)
  jogadores.forEach((linha, indice) => {
    linha.posicao = indice + 1
  })

  return {
    fundamentos: [
      ...COLUNAS_FIXAS.map((id) => ({ id, rotulo: ROTULO[id] })),
      ...colunasExtras.map((id) => ({ id, rotulo: ROTULO[id] ?? id })),
    ],
    jogadores,
  }
}

export function ordenarJogadores(jogadores: LinhaJogadorRanking[], coluna: string, direcao: 'asc' | 'desc') {
  const fator = direcao === 'asc' ? 1 : -1
  return [...jogadores].sort((a, b) => {
    let delta = 0
    if (coluna === 'posicao') delta = a.posicao - b.posicao
    else if (coluna === 'nome') delta = a.nome.localeCompare(b.nome, 'pt')
    else if (coluna === 'equipe') delta = a.equipe.localeCompare(b.equipe, 'pt') || a.nome.localeCompare(b.nome, 'pt')
    else if (coluna === 'total') delta = a.total - b.total || a.posicao - b.posicao
    else delta = (a.fundamentos[coluna] ?? 0) - (b.fundamentos[coluna] ?? 0) || a.posicao - b.posicao
    return delta * fator
  })
}
