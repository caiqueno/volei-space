export type EstadoEncerramento = {
  status: string
  sumulaAprovadaEm: string | null
  setsPorA: number
  setsPorB: number
}

export function andamentoPodeGravar(partida: { status?: string | null; sumulaAprovadaEm?: string | Date | null }) {
  if (String(partida.status ?? '').trim().toUpperCase() === 'ENCERRADA') return false
  if (partida.sumulaAprovadaEm) return false
  return true
}

/**
 * O PUT só grava placar se a linha ainda estiver aberta.
 * É a mesma condição de `.neq('status','ENCERRADA').is('sumulaAprovadaEm', null)`.
 * O status lido no começo do pedido não entra: vale o estado atual.
 */
export function aplicarAndamentoSeAberta(
  estado: EstadoEncerramento,
  andamento: { setsPorA: number; setsPorB: number },
) {
  if (!andamentoPodeGravar(estado)) return { estado, gravou: false }
  return {
    gravou: true,
    estado: {
      ...estado,
      status: 'EM_ANDAMENTO',
      setsPorA: andamento.setsPorA,
      setsPorB: andamento.setsPorB,
    },
  }
}

export function oficializarPartida(
  estado: EstadoEncerramento,
  oficial: { setsPorA: number; setsPorB: number; em: string },
): EstadoEncerramento {
  return {
    status: 'ENCERRADA',
    sumulaAprovadaEm: oficial.em,
    setsPorA: oficial.setsPorA,
    setsPorB: oficial.setsPorB,
  }
}

/** Se o PUT passou na frente e deixou EM_ANDAMENTO, a oficialização grava de novo. */
export function reconferirEncerramento(
  estado: EstadoEncerramento,
  oficial: { setsPorA: number; setsPorB: number; em: string },
) {
  if (String(estado.status ?? '').trim().toUpperCase() === 'ENCERRADA') {
    return { estado, regravou: false }
  }
  return { estado: oficializarPartida(estado, oficial), regravou: true }
}
