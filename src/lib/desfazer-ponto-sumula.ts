import { ehPontoSemJogador } from '@/lib/ponto-sumula'

export type LadoQuadra = 'teamA' | 'teamB'

export type EventoParaDesfazer = {
  id: string
  type: string
  text: string
  set?: number | null
  score?: string | null
  teamId?: string | null
}

export type EntradaHistoricoPonto = {
  score: { teamA: number; teamB: number }
  servingTeamId: LadoQuadra
  serverIndexA: number
  serverIndexB: number
  lineupA: string[]
  lineupB: string[]
  eventIds: string[]
  set?: number
}

export type EntradaParaCorrigir = {
  score: { teamA: number; teamB: number }
  set?: number | null
}

/** O placar guardado antes do ponto só vale se ainda for deste set e for menor que o atual. */
export function entradaDoSetCorrente(
  entrada: EntradaParaCorrigir,
  setAtual: number,
  placarAtual: { teamA: number; teamB: number },
) {
  if (entrada.set != null && entrada.set !== setAtual) return false
  if (entrada.score.teamA > placarAtual.teamA || entrada.score.teamB > placarAtual.teamB) return false
  return entrada.score.teamA + entrada.score.teamB < placarAtual.teamA + placarAtual.teamB
}

/**
 * Índice da entrada que o desfazer deve restaurar.
 * Para no set anterior: um placar maior que o atual (23x13 contra 0x1) não é ponto deste set.
 */
export function indiceDoUltimoPonto(entrada: {
  historico: EntradaParaCorrigir[]
  placarAtual: { teamA: number; teamB: number }
  setAtual: number
  equipe?: LadoQuadra | null
}) {
  for (let i = entrada.historico.length - 1; i >= 0; i -= 1) {
    const item = entrada.historico[i]
    if (!entradaDoSetCorrente(item, entrada.setAtual, entrada.placarAtual)) return -1
    if (!entrada.equipe) return i
    const depois = i === entrada.historico.length - 1 ? entrada.placarAtual : entrada.historico[i + 1].score
    if (depois[entrada.equipe] > item.score[entrada.equipe]) return i
  }
  return -1
}

const TIPOS_PONTO = new Set(['ace', 'attack', 'block', 'point'])

export function placarSalvo(score: string | null | undefined) {
  const match = String(score ?? '').match(/(\d+)\s*x\s*(\d+)/i)
  if (!match) return null
  return { teamA: Number(match[1]), teamB: Number(match[2]) }
}

export function desfazerRodizio(lineup: string[]) {
  if (lineup.length < 6) return [...lineup]
  return [lineup[1], lineup[2], lineup[5], lineup[0], lineup[3], lineup[4]]
}

function outro(lado: LadoQuadra): LadoQuadra {
  return lado === 'teamA' ? 'teamB' : 'teamA'
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function lerRotacao(texto: string) {
  const match = texto.match(/\[\[ROT:\d+:(teamA|teamB):([^:]*):([^\]]*)\]\]/)
  if (!match) return null
  return {
    servingTeamId: match[1] as LadoQuadra,
    lineupA: match[2].split(','),
    lineupB: match[3].split(','),
  }
}

function ehPonto(evento: EventoParaDesfazer) {
  return TIPOS_PONTO.has(evento.type) || ehPontoSemJogador(evento.text)
}

function quemPontuou(
  antes: { teamA: number; teamB: number },
  depois: { teamA: number; teamB: number },
  evento: EventoParaDesfazer,
  nomeA: string,
  nomeB: string,
): LadoQuadra | null {
  if (depois.teamA === antes.teamA + 1 && depois.teamB === antes.teamB) return 'teamA'
  if (depois.teamB === antes.teamB + 1 && depois.teamA === antes.teamA) return 'teamB'
  if (evento.teamId === 'teamA' || evento.teamId === 'teamB') return evento.teamId
  const texto = normalizar(evento.text)
  if (nomeA && texto.includes(normalizar(`para ${nomeA}`))) return 'teamA'
  if (nomeB && texto.includes(normalizar(`para ${nomeB}`))) return 'teamB'
  return null
}

function copiar(lineup: string[]) {
  return [...lineup]
}

export function reconstruirHistoricoPontos(entrada: {
  eventos: EventoParaDesfazer[]
  setAtual: number
  saqueAtual: LadoQuadra
  escalacaoA: string[]
  escalacaoB: string[]
  nomeA: string
  nomeB: string
}): EntradaHistoricoPonto[] {
  const doSet = entrada.eventos.filter((evento) => Number(evento.set ?? entrada.setAtual) === entrada.setAtual)
  const pontos = doSet
    .filter(ehPonto)
    .map((evento) => ({ evento, placar: placarSalvo(evento.score) }))
    .filter((item): item is { evento: EventoParaDesfazer; placar: { teamA: number; teamB: number } } => item.placar != null)
    .sort((a, b) => (a.placar.teamA + a.placar.teamB) - (b.placar.teamA + b.placar.teamB) || a.placar.teamA - b.placar.teamA)

  const trocas = doSet.filter((evento) => normalizar(evento.text).includes('troca de saque'))
  let lineupA = copiar(entrada.escalacaoA)
  let lineupB = copiar(entrada.escalacaoB)
  let saque = entrada.saqueAtual
  const pilha: EntradaHistoricoPonto[] = []

  for (let indice = pontos.length - 1; indice >= 0; indice -= 1) {
    const atual = pontos[indice]
    const anterior = indice === 0 ? { teamA: 0, teamB: 0 } : pontos[indice - 1].placar
    const quem = quemPontuou(anterior, atual.placar, atual.evento, entrada.nomeA, entrada.nomeB)
    if (!quem) continue
    const troca = trocas.find((evento) => {
      const placar = placarSalvo(evento.score)
      return placar?.teamA === atual.placar.teamA && placar.teamB === atual.placar.teamB
    })
    const rotacao = troca ? lerRotacao(troca.text) : null
    const depoisA = rotacao?.lineupA?.length ? rotacao.lineupA : lineupA
    const depoisB = rotacao?.lineupB?.length ? rotacao.lineupB : lineupB
    const antesA = troca && quem === 'teamA' ? desfazerRodizio(depoisA) : copiar(troca ? depoisA : lineupA)
    const antesB = troca && quem === 'teamB' ? desfazerRodizio(depoisB) : copiar(troca ? depoisB : lineupB)
    const antesSaque = troca ? outro(quem) : saque
    pilha.push({
      score: { ...anterior },
      servingTeamId: antesSaque,
      serverIndexA: 5,
      serverIndexB: 5,
      lineupA: antesA,
      lineupB: antesB,
      eventIds: [atual.evento.id, troca?.id].filter((id): id is string => Boolean(id)),
      set: entrada.setAtual,
    })
    lineupA = antesA
    lineupB = antesB
    saque = antesSaque
  }

  return pilha.reverse()
}
