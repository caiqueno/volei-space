export const INTERVALO_PONTO_MS = 8000
export const VELOCIDADES_SIMULACAO = [1, 2, 4, 8] as const
export const EMAIL_ARBITRO_SIMULACAO = /@example\.invalid$/

export type VelocidadeSimulacao = (typeof VELOCIDADES_SIMULACAO)[number]

export type StatusPartidaSimulacao = 'AGENDADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA' | 'WO'

export type PlacarSimulacao = {
  pausada: boolean
  velocidade: VelocidadeSimulacao
  acumuladoMs: number
  marcaEm: number
  ultimoPontoMs: number
  pontosA: number
  pontosB: number
  setsA: number
  setsB: number
  setNumero: number
  proximoLado: 'A' | 'B'
}

export type SetFechado = { numero: number; pontosA: number; pontosB: number }

export function ehSimulacao(registro: { simulacao?: boolean | null } | null | undefined) {
  return registro?.simulacao === true
}

export function podeApagarSimulacao(registro: { simulacao?: boolean | null } | null | undefined) {
  return ehSimulacao(registro)
}

export function relogioSimuladoMs(placar: Pick<PlacarSimulacao, 'pausada' | 'acumuladoMs' | 'marcaEm' | 'velocidade'>, agoraMs: number) {
  if (placar.pausada) return placar.acumuladoMs
  const decorrido = Math.max(0, agoraMs - placar.marcaEm)
  return placar.acumuladoMs + decorrido * placar.velocidade
}

export function pausarPlacar(placar: PlacarSimulacao, agoraMs: number): PlacarSimulacao {
  return {
    ...placar,
    pausada: true,
    acumuladoMs: relogioSimuladoMs(placar, agoraMs),
    marcaEm: agoraMs,
  }
}

export function retomarPlacar(placar: PlacarSimulacao, agoraMs: number): PlacarSimulacao {
  return { ...placar, pausada: false, marcaEm: agoraMs }
}

export function definirVelocidade(placar: PlacarSimulacao, velocidade: number, agoraMs: number): PlacarSimulacao {
  const permitida = VELOCIDADES_SIMULACAO.find((item) => item === velocidade) ?? 1
  const acumuladoMs = relogioSimuladoMs(placar, agoraMs)
  return { ...placar, velocidade: permitida, acumuladoMs, marcaEm: agoraMs }
}

export function setEncerrado(pontosA: number, pontosB: number, alvo: number, margem: number) {
  const maior = Math.max(pontosA, pontosB)
  const menor = Math.min(pontosA, pontosB)
  return maior >= alvo && maior - menor >= margem
}

export function setsParaVencer(setsPorPartida: number) {
  const total = Number.isFinite(setsPorPartida) && setsPorPartida > 0 ? Math.floor(setsPorPartida) : 3
  return Math.ceil(total / 2)
}

export function placarInicial(agoraMs: number, velocidade: VelocidadeSimulacao = 1): PlacarSimulacao {
  return {
    pausada: false,
    velocidade,
    acumuladoMs: 0,
    marcaEm: agoraMs,
    ultimoPontoMs: 0,
    pontosA: 0,
    pontosB: 0,
    setsA: 0,
    setsB: 0,
    setNumero: 1,
    proximoLado: 'A',
  }
}

export function avancarPlacar(
  placar: PlacarSimulacao,
  agoraMs: number,
  alvo: number,
  margem: number,
  vitoriasNecessarias: number,
) {
  if (placar.pausada) return { placar, sets: [] as SetFechado[], encerrada: false }
  const atual = relogioSimuladoMs(placar, agoraMs)
  const sets: SetFechado[] = []
  const next: PlacarSimulacao = { ...placar, acumuladoMs: atual, marcaEm: agoraMs }
  let encerrada = next.setsA >= vitoriasNecessarias || next.setsB >= vitoriasNecessarias
  while (!encerrada && next.ultimoPontoMs + INTERVALO_PONTO_MS <= atual) {
    next.ultimoPontoMs += INTERVALO_PONTO_MS
    const pontoParaA = (next.pontosA + next.pontosB) % 3 !== 2
    if (pontoParaA) next.pontosA += 1
    else next.pontosB += 1
    next.proximoLado = pontoParaA ? 'B' : 'A'
    if (setEncerrado(next.pontosA, next.pontosB, alvo, margem)) {
      sets.push({ numero: next.setNumero, pontosA: next.pontosA, pontosB: next.pontosB })
      if (next.pontosA > next.pontosB) next.setsA += 1
      else next.setsB += 1
      next.setNumero += 1
      next.pontosA = 0
      next.pontosB = 0
      encerrada = next.setsA >= vitoriasNecessarias || next.setsB >= vitoriasNecessarias
    }
  }
  return { placar: next, sets, encerrada }
}

export function podeIniciarPartida(statusPartida: string, statusCampeonato: string) {
  const partida = statusPartida.toUpperCase()
  const campeonato = statusCampeonato.toUpperCase()
  if (campeonato === 'FINALIZADO') return 'Este campeonato está finalizado e disponível apenas para consulta.'
  if (partida === 'ENCERRADA' || partida === 'WO' || partida === 'CANCELADA') return 'Esta partida não pode ser iniciada.'
  if (partida === 'EM_ANDAMENTO') return 'Esta partida já está em andamento.'
  return null
}

export function podeEncerrarPartida(statusPartida: string, statusCampeonato: string) {
  const partida = statusPartida.toUpperCase()
  const campeonato = statusCampeonato.toUpperCase()
  if (campeonato === 'FINALIZADO') return 'Este campeonato está finalizado e disponível apenas para consulta.'
  if (partida === 'ENCERRADA') return 'Esta partida já está encerrada.'
  if (partida !== 'EM_ANDAMENTO') return 'Só é possível encerrar uma partida em andamento.'
  return null
}

export function arbitroPodeOperar(arbitroId: number | null, escala: Array<{ arbitroId: number }>) {
  if (escala.length === 0) return false
  return escala.some((item) => item.arbitroId === arbitroId)
}

export function lerPlacar(valor: unknown, agoraMs: number): PlacarSimulacao {
  const bruto = valor && typeof valor === 'object' ? valor as Partial<PlacarSimulacao> : {}
  const base = placarInicial(agoraMs)
  const velocidade = VELOCIDADES_SIMULACAO.find((item) => item === bruto.velocidade) ?? 1
  return {
    ...base,
    ...bruto,
    velocidade,
    pausada: Boolean(bruto.pausada),
    acumuladoMs: Number(bruto.acumuladoMs) || 0,
    marcaEm: Number(bruto.marcaEm) || agoraMs,
    ultimoPontoMs: Number(bruto.ultimoPontoMs) || 0,
    pontosA: Number(bruto.pontosA) || 0,
    pontosB: Number(bruto.pontosB) || 0,
    setsA: Number(bruto.setsA) || 0,
    setsB: Number(bruto.setsB) || 0,
    setNumero: Number(bruto.setNumero) || 1,
    proximoLado: bruto.proximoLado === 'B' ? 'B' : 'A',
  }
}
