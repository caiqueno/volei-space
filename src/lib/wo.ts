/**
 * W.O. configurável. Sem placar gravado, o jogo continua valendo vitória
 * por margem de 2 ou mais sets e zero sets no saldo — o comportamento atual.
 * Com placar configurado, sets e pontos do rally entram na tabela.
 * A punição, em pontos de campeonato, sai de quem perde o W.O. e também
 * soma na coluna de punições. Zero ou ausente não altera o campeonato.
 */

export type WoConfig = {
  setsVencedor?: number | null
  setsPerdedor?: number | null
  pontosSetVencedor?: number | null
  pontosSetPerdedor?: number | null
  punicaoPontos?: number | null
}

export const WO_PADRAO = {
  setsVencedor: null,
  setsPerdedor: null,
  pontosSetVencedor: null,
  pontosSetPerdedor: null,
  punicaoPontos: 0,
}

export function woConfigurado(config?: WoConfig | null) {
  const sets = numeroOpcional(config?.setsVencedor)
  return sets != null && sets > 0
}

export function normalizarWo(config?: WoConfig | null) {
  return {
    setsVencedor: numeroOpcional(config?.setsVencedor),
    setsPerdedor: numeroOpcional(config?.setsPerdedor) ?? 0,
    pontosSetVencedor: numeroOpcional(config?.pontosSetVencedor) ?? 0,
    pontosSetPerdedor: numeroOpcional(config?.pontosSetPerdedor) ?? 0,
    punicaoPontos: Math.max(0, numeroOpcional(config?.punicaoPontos) ?? 0),
  }
}

export type PlacarWo = {
  setsA: number
  setsB: number
  pontosA: number
  pontosB: number
  punicaoNoPerdedor: number
}

/** Placar do W.O. já no lado A/B da partida. Sem configuração, sets e pontos ficam em zero. */
export function placarDoWo(config: WoConfig | null | undefined, vencedorEhA: boolean): PlacarWo {
  const wo = normalizarWo(config)
  if (!woConfigurado(wo)) {
    return { setsA: 0, setsB: 0, pontosA: 0, pontosB: 0, punicaoNoPerdedor: wo.punicaoPontos }
  }
  const setsV = wo.setsVencedor ?? 0
  const setsP = wo.setsPerdedor ?? 0
  const pontosV = setsV * (wo.pontosSetVencedor ?? 0)
  const pontosP = setsV * (wo.pontosSetPerdedor ?? 0)
  if (vencedorEhA) {
    return { setsA: setsV, setsB: setsP, pontosA: pontosV, pontosB: pontosP, punicaoNoPerdedor: wo.punicaoPontos }
  }
  return { setsA: setsP, setsB: setsV, pontosA: pontosP, pontosB: pontosV, punicaoNoPerdedor: wo.punicaoPontos }
}

function numeroOpcional(valor: unknown) {
  if (valor == null || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  return numero
}
