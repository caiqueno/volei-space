export type Lado = 'A' | 'B'

export const MAX_TEMPOS = 2
export const MAX_SUBS = 6
export const MAX_DESAFIOS = 2
export const SETS_PARA_VENCER = 3

interface Base {
  set: number
  pontos: Record<Lado, number>
  sets: Record<Lado, number>
  saque: Lado
  rotacao: Record<Lado, number>
  tempos: Record<Lado, number>
  subs: Record<Lado, number>
  pedidoBanco: { lado: Lado; tipo: 'tempo' | 'troca' } | null
  desafios: Record<Lado, number>
  historico: string[]
  vencedor: Lado | null
}

export interface EstadoPlacar extends Base {
  anteriores: Base[]
}

export type AcaoPlacar =
  | { tipo: 'ponto'; lado: Lado }
  | { tipo: 'desfazer' }
  | { tipo: 'tempo'; lado: Lado }
  | { tipo: 'substituicao'; lado: Lado }
  | { tipo: 'pedido'; lado: Lado; pedido: 'tempo' | 'troca' }
  | { tipo: 'aceitar-pedido' }
  | { tipo: 'recusar-pedido' }
  | { tipo: 'desafio'; lado: Lado }
  | { tipo: 'reiniciar' }

export function placarInicial(): EstadoPlacar {
  return {
    set: 1,
    pontos: { A: 0, B: 0 },
    sets: { A: 0, B: 0 },
    saque: 'A',
    rotacao: { A: 0, B: 0 },
    tempos: { A: 0, B: 0 },
    subs: { A: 0, B: 0 },
    pedidoBanco: null,
    desafios: { A: 0, B: 0 },
    historico: [],
    anteriores: [],
    vencedor: null,
  }
}

export function pontosDoSet(set: number): number {
  return set === 5 ? 15 : 25
}

export function setEncerrado(pontos: Record<Lado, number>, set: number): Lado | null {
  const alvo = pontosDoSet(set)
  for (const lado of ['A', 'B'] as Lado[]) {
    const adv: Lado = lado === 'A' ? 'B' : 'A'
    if (pontos[lado] >= alvo && pontos[lado] - pontos[adv] >= 2) return lado
  }
  return null
}

function instantaneo(e: EstadoPlacar): Base {
  const { anteriores: _ignorado, ...base } = e
  void _ignorado
  return base
}

function aplicar(e: EstadoPlacar, mudanca: Partial<Base>, linha: string): EstadoPlacar {
  return {
    ...e,
    ...mudanca,
    historico: [linha, ...e.historico].slice(0, 30),
    anteriores: [...e.anteriores, instantaneo(e)].slice(-50),
  }
}

export function reducerPlacar(e: EstadoPlacar, a: AcaoPlacar): EstadoPlacar {
  if (a.tipo === 'reiniciar') return placarInicial()
  if (a.tipo === 'desfazer') {
    const ultimo = e.anteriores[e.anteriores.length - 1]
    if (!ultimo) return e
    return { ...ultimo, anteriores: e.anteriores.slice(0, -1) }
  }
  if (e.vencedor) return e

  switch (a.tipo) {
    case 'ponto': {
      const pontos = { ...e.pontos, [a.lado]: e.pontos[a.lado] + 1 }
      const rotacao = { ...e.rotacao }
      let saque = e.saque
      if (e.saque !== a.lado) {
        saque = a.lado
        rotacao[a.lado] = (rotacao[a.lado] + 1) % 6
      }
      const ganhou = setEncerrado(pontos, e.set)
      if (!ganhou) return aplicar(e, { pontos, saque, rotacao }, `Ponto ${a.lado} (${pontos.A} x ${pontos.B})`)
      const sets = { ...e.sets, [ganhou]: e.sets[ganhou] + 1 }
      const linha = `Set ${e.set} para ${ganhou} (${pontos.A} x ${pontos.B})`
      if (sets[ganhou] >= SETS_PARA_VENCER) return aplicar(e, { pontos, sets, saque, rotacao, vencedor: ganhou }, linha)
      return aplicar(
        e,
        {
          set: e.set + 1,
          pontos: { A: 0, B: 0 },
          sets,
          saque,
          rotacao,
          tempos: { A: 0, B: 0 },
          subs: { A: 0, B: 0 },
          pedidoBanco: null,
        },
        linha,
      )
    }
    case 'tempo':
      if (e.tempos[a.lado] >= MAX_TEMPOS) return e
      return aplicar(e, { tempos: { ...e.tempos, [a.lado]: e.tempos[a.lado] + 1 } }, `Tempo ${a.lado}`)
    case 'substituicao':
      if (e.subs[a.lado] >= MAX_SUBS) return e
      return aplicar(e, { subs: { ...e.subs, [a.lado]: e.subs[a.lado] + 1 } }, `Substituição ${a.lado}`)
    case 'pedido':
      return { ...e, pedidoBanco: { lado: a.lado, tipo: a.pedido } }
    case 'recusar-pedido':
      return { ...e, pedidoBanco: null }
    case 'aceitar-pedido': {
      if (!e.pedidoBanco) return e
      const { lado, tipo } = e.pedidoBanco
      if (tipo === 'tempo') {
        if (e.tempos[lado] >= MAX_TEMPOS) return { ...e, pedidoBanco: null }
        return aplicar(e, { tempos: { ...e.tempos, [lado]: e.tempos[lado] + 1 }, pedidoBanco: null }, `Pedido aceito: tempo ${lado}`)
      }
      if (e.subs[lado] >= MAX_SUBS) return { ...e, pedidoBanco: null }
      return aplicar(e, { subs: { ...e.subs, [lado]: e.subs[lado] + 1 }, pedidoBanco: null }, `Pedido aceito: substituição ${lado}`)
    }
    case 'desafio':
      if (e.desafios[a.lado] >= MAX_DESAFIOS) return e
      return aplicar(e, { desafios: { ...e.desafios, [a.lado]: e.desafios[a.lado] + 1 } }, `Desafio ${a.lado}`)
  }
}
