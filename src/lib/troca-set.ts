import { modoSaqueInicial, saqueObrigatorio, type LadoSaque, type ModoSaqueInicial } from '@/lib/saque-inicial'

export type TransicaoSet = {
  segue: boolean
  proximoSet: number | null
  ladosInvertidos: boolean
  saque: LadoSaque | null
  modoSaque: ModoSaqueInicial
}

/**
 * Encerrar um set que ainda não fecha a partida troca o lado da quadra.
 * O saque do set seguinte reusa a regra já aprovada: alternância nos sets
 * 2 a 4 e sorteio no 5º. O lado é só visual; o id da equipe que saca não muda.
 */
export function transicaoAoEncerrarSet(input: {
  setAtual: number
  setsPorPartida: number
  setsParaVencer: number
  setsA: number
  setsB: number
  ladosInvertidos: boolean
  saqueInicialDoSet: LadoSaque | null
}): TransicaoSet {
  const segue = input.setAtual < input.setsPorPartida
    && input.setsA < input.setsParaVencer
    && input.setsB < input.setsParaVencer
  if (!segue) {
    return {
      segue: false,
      proximoSet: null,
      ladosInvertidos: input.ladosInvertidos,
      saque: null,
      modoSaque: modoSaqueInicial(input.setAtual),
    }
  }
  const proximoSet = input.setAtual + 1
  return {
    segue: true,
    proximoSet,
    ladosInvertidos: !input.ladosInvertidos,
    saque: saqueObrigatorio(proximoSet, input.saqueInicialDoSet),
    modoSaque: modoSaqueInicial(proximoSet),
  }
}
