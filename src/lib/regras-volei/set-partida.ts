/**
 * Set e partida: alvos, margem, set decisivo, fim de partida, troca de lado,
 * saque inicial e tempos. RG-SET-*, RG-FOR-002/003, RG-TMP-001/002/005.
 */
import type { ConfigPartida } from './config'
import { aviso, bloqueio, ok, outraEquipe, type Equipe, type PlacarSet, type ResultadoRegra } from './tipos'

/** Sets necessários para vencer (maioria). RG-SET-004. */
export function setsParaVencer(melhorDe: number): number {
  return Math.floor(melhorDe / 2) + 1
}

/**
 * Set decisivo: ambos a um set da vitória (ex.: 2x2 no melhor de 5, 1x1 no melhor de 3).
 * Com 3º set obrigatório após 2x0 ele NÃO é decisivo [M] (sem novo sorteio nem troca aos 8).
 */
export function ehSetDecisivo(config: ConfigPartida, setsA: number, setsB: number): boolean {
  const falta = setsParaVencer(config.melhorDe) - 1
  return setsA === falta && setsB === falta
}

/**
 * Alvo de pontos do set `numeroSet` (1-based). O último set possível da partida usa o
 * alvo do decisivo (`Nt`); inclusive o 3º obrigatório após 2x0 (D2, "jogado até Nt").
 */
export function alvoDoSet(config: ConfigPartida, numeroSet: number): number {
  return numeroSet >= config.melhorDe ? config.alvoSetDecisivo : config.alvoSet
}

/** RG-SET-001/002: alvo atingido com a vantagem mínima; sem teto. */
export function setEncerrado(placar: PlacarSet, alvo: number, margem = 2): boolean {
  const maior = Math.max(placar.a, placar.b)
  const menor = Math.min(placar.a, placar.b)
  return maior >= alvo && maior - menor >= margem
}

export function vencedorDoSet(placar: PlacarSet, alvo: number, margem = 2): Equipe | null {
  if (!setEncerrado(placar, alvo, margem)) return null
  return placar.a > placar.b ? 'A' : 'B'
}

/** Valida o placar FINAL de um set informado/derivado (RG-SET-001/002). */
export function validarPlacarFinalSet(placar: PlacarSet, alvo: number, margem = 2): ResultadoRegra {
  if (!Number.isInteger(placar.a) || !Number.isInteger(placar.b) || placar.a < 0 || placar.b < 0) {
    return bloqueio('RG-SET-001', 'O placar do set deve ter pontos inteiros e não negativos.')
  }
  if (!setEncerrado(placar, alvo, margem)) {
    const maior = Math.max(placar.a, placar.b)
    if (maior < alvo) {
      return bloqueio('RG-SET-001', `O set só termina quando uma equipe chega a ${alvo} pontos. Placar ${placar.a}x${placar.b} ainda está em andamento.`)
    }
    return bloqueio('RG-SET-002', `O set exige ${margem} pontos de vantagem. Placar ${placar.a}x${placar.b} continua até a diferença de ${margem}.`)
  }
  const maior = Math.max(placar.a, placar.b)
  const menor = Math.min(placar.a, placar.b)
  // Sem teto, mas o vencedor não pode ter passado do ponto necessário (ex.: 27x24 é impossível).
  if (maior > alvo && maior - menor !== margem) {
    return bloqueio('RG-SET-002', `Placar ${placar.a}x${placar.b} é impossível: o set teria terminado antes, com ${margem} pontos de vantagem.`)
  }
  return ok()
}

export interface SetFinalizado {
  placar: PlacarSet
}

export function contarSets(sets: SetFinalizado[], config: ConfigPartida): { a: number; b: number } {
  let a = 0
  let b = 0
  sets.forEach((set, i) => {
    const venc = vencedorDoSet(set.placar, alvoDoSet(config, i + 1), config.margem)
    if (venc === 'A') a += 1
    else if (venc === 'B') b += 1
  })
  return { a, b }
}

/**
 * RG-SET-004 (+ D2): a partida acaba quando alguém tem a maioria dos sets.
 * Com `terceiroSetObrigatorio` (melhor de 3), 2x0 não encerra: joga-se o 3º set.
 */
export function partidaEncerrada(setsA: number, setsB: number, config: ConfigPartida): boolean {
  const necessarios = setsParaVencer(config.melhorDe)
  if (Math.max(setsA, setsB) < necessarios) return false
  if (config.terceiroSetObrigatorio && config.melhorDe === 3) return setsA + setsB >= 3
  return true
}

/** RG-SET-001..004: valida a sequência completa de sets de uma partida encerrada. */
export function validarSequenciaDePartida(sets: SetFinalizado[], config: ConfigPartida): ResultadoRegra {
  let a = 0
  let b = 0
  for (let i = 0; i < sets.length; i += 1) {
    if (partidaEncerrada(a, b, config)) {
      return bloqueio('RG-SET-004', `A partida já terminou em ${a}x${b}; o ${i + 1}º set não existe.`)
    }
    const set = sets[i]!
    const r = validarPlacarFinalSet(set.placar, alvoDoSet(config, i + 1), config.margem)
    if (!r.ok) return bloqueio(r.codigo, `${i + 1}º set: ${r.mensagem}`)
    if (set.placar.a > set.placar.b) a += 1
    else b += 1
  }
  if (!partidaEncerrada(a, b, config)) {
    return bloqueio('RG-SET-003', `A partida ainda não terminou: ${a}x${b} em sets (melhor de ${config.melhorDe}).`)
  }
  return ok()
}

/** RG-SET-006: no set decisivo, troca de quadra quando a líder atinge o ponto configurado (8). */
export function deveTrocarDeLado(
  config: ConfigPartida,
  params: { decisivo: boolean; placar: PlacarSet; jaTrocou: boolean },
): boolean {
  if (!params.decisivo || params.jaTrocou) return false
  return Math.max(params.placar.a, params.placar.b) >= config.trocaLadoNoDecisivoEm
}

/**
 * RG-FOR-002/003: saque inicial dos sets 2 a 4 é da equipe que NÃO sacou primeiro no set anterior.
 * No set decisivo há novo sorteio (retorna 'SORTEIO').
 */
export function saqueInicialDoSet(params: {
  decisivo: boolean
  sacouPrimeiroNoSetAnterior: Equipe | null
}): Equipe | 'SORTEIO' {
  if (params.decisivo || params.sacouPrimeiroNoSetAnterior === null) return 'SORTEIO'
  return outraEquipe(params.sacouPrimeiroNoSetAnterior)
}

/** RG-TMP-001/002/005: pedido de tempo (2 por set, bola fora e antes do apito). */
export function validarPedidoDeTempo(params: {
  temposUsados: number
  limite: number
  bolaForaDeJogo: boolean
  antesDoApito: boolean
}): ResultadoRegra {
  if (!params.bolaForaDeJogo || !params.antesDoApito) {
    return bloqueio('RG-TMP-002', 'Tempo só pode ser pedido com a bola fora de jogo e antes do apito do saque.')
  }
  if (params.temposUsados >= params.limite) {
    return bloqueio('RG-TMP-001', `A equipe já usou os ${params.limite} tempos do set. O pedido é indevido (o primeiro indevido é só registrado; os seguintes são atraso).`)
  }
  return ok()
}

/* ------------------------------------------------------------------ */
/* RG-SET-005: intervalo entre sets                                    */
/* ------------------------------------------------------------------ */

/** RG-SET-005 (18.1): intervalo padrão entre sets. */
export const INTERVALO_PADRAO_MINUTOS = 3
/** RG-SET-005 (18.1): o intervalo entre o 2º e o 3º sets pode chegar a 10 minutos a pedido do organizador. */
export const INTERVALO_LONGO_MAX_MINUTOS = 10

export interface IntervaloEntreSets {
  /** Duração permitida em minutos. */
  minutos: number
  /** É o intervalo longo (entre o 2º e o 3º sets) configurado pelo organizador. */
  longo: boolean
  /** No intervalo as equipes trocam de quadra e entregam as papeletas do set seguinte (18.1). */
  trocamDeQuadra: true
  entregamPapeletas: true
}

/**
 * RG-SET-005: duração do intervalo depois do set `setQueTerminou`. `null` quando não há set seguinte possível
 * (depois do último set da partida não há intervalo).
 */
export function duracaoDoIntervalo(config: ConfigPartida, setQueTerminou: number): IntervaloEntreSets | null {
  if (setQueTerminou >= config.melhorDe) return null
  const longo = setQueTerminou === 2 && config.intervaloLongoEntre2e3Minutos !== undefined
  return {
    minutos: longo ? config.intervaloLongoEntre2e3Minutos! : INTERVALO_PADRAO_MINUTOS,
    longo,
    trocamDeQuadra: true,
    entregamPapeletas: true,
  }
}

/** RG-SET-005: o intervalo longo configurado precisa estar entre 3 e 10 minutos. */
export function validarConfigIntervalo(config: ConfigPartida): ResultadoRegra {
  const v = config.intervaloLongoEntre2e3Minutos
  if (v === undefined) return ok()
  if (!Number.isFinite(v) || v < INTERVALO_PADRAO_MINUTOS || v > INTERVALO_LONGO_MAX_MINUTOS) {
    return bloqueio('RG-SET-005', `O intervalo longo entre o 2º e o 3º sets vai de ${INTERVALO_PADRAO_MINUTOS} a ${INTERVALO_LONGO_MAX_MINUTOS} minutos.`)
  }
  return ok()
}

/**
 * RG-SET-005: compara o intervalo realmente decorrido com o permitido. Passar do limite não invalida a súmula
 * (é um fato da quadra): devolve um aviso para o apontador lançar o horário real no quadro de observações.
 */
export function conferirIntervalo(config: ConfigPartida, setQueTerminou: number, minutosDecorridos: number): ResultadoRegra {
  const configValida = validarConfigIntervalo(config)
  if (!configValida.ok) return configValida
  const previsto = duracaoDoIntervalo(config, setQueTerminou)
  if (previsto === null) return bloqueio('RG-SET-005', `Não há intervalo depois do ${setQueTerminou}º set: a partida acaba nele.`)
  if (minutosDecorridos > previsto.minutos) {
    return ok([
      aviso(
        'RG-SET-005',
        `O intervalo durou ${minutosDecorridos} min e o previsto é de ${previsto.minutos} min${previsto.longo ? ' (intervalo longo pedido pelo organizador)' : ''}: lance o horário real nas observações.`,
      ),
    ])
  }
  return ok()
}
