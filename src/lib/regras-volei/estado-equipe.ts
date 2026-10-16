/**
 * Estado serializável (JSON puro) de uma equipe em um set, usado por substituições,
 * líbero e sanções. Arrays em vez de Set/Map para poder ir em payload/snapshot.
 */
import type { Formacao } from './tipos'

export interface ParSubstituicao {
  /** Titular do set que saiu. */
  titular: number
  /** Reserva que entrou no lugar dele. */
  reserva: number
  /** O titular já voltou ao lugar do reserva (fecha o par). */
  retornou: boolean
}

export interface EstadoEquipe {
  /** Relação nominal: todos os jogadores registrados (inclui líberos). */
  elenco: number[]
  /** Líberos registrados e capazes (até 2). */
  liberos: number[]
  /** Líberos que ficaram incapazes/expulsos/redesignados (não jogam mais). */
  liberosIncapazes: number[]
  /** 6 posições [I, II, III, IV, V, VI]. */
  emQuadra: number[]
  /** Formação inicial do set (papeleta). */
  titularesSet: number[]
  /** Jogador regular que o líbero em quadra está substituindo (se houver). */
  substituidoPorLibero: number | null
  regulares: number
  excepcionais: number
  pares: ParSubstituicao[]
  /** Reservas que já entraram no set (RG-SUB-004: uma vez por set). */
  jaEntraramNoSet: number[]
  /** Substituídos excepcionalmente (lesionados): não voltam mais à partida (RG-SUB-011). */
  semRetorno: number[]
  /** Expulsos no set corrente (RG-SAN-007). */
  expulsosNoSet: number[]
  /** Desqualificados na partida (RG-SAN-008). */
  desqualificados: number[]
  /** Jogadores que já usaram os 3 min de recuperação (RG-SUB-013). */
  recuperacaoUsada: number[]
  /** RG-SUB-007: já houve pedido de substituição nesta interrupção (sem rally concluído). */
  pedidoNaInterrupcao: boolean
  /** RG-LIB-005: houve rally concluído desde a última troca de líbero. */
  rallyConcluidoDesdeTrocaLibero: boolean
}

export function criarEstadoEquipe(params: {
  elenco: number[]
  liberos?: number[]
  formacaoInicial: Formacao
}): EstadoEquipe {
  return {
    elenco: [...params.elenco],
    liberos: [...(params.liberos ?? [])],
    liberosIncapazes: [],
    emQuadra: [...params.formacaoInicial],
    titularesSet: [...params.formacaoInicial],
    substituidoPorLibero: null,
    regulares: 0,
    excepcionais: 0,
    pares: [],
    jaEntraramNoSet: [],
    semRetorno: [],
    expulsosNoSet: [],
    desqualificados: [],
    recuperacaoUsada: [],
    pedidoNaInterrupcao: false,
    rallyConcluidoDesdeTrocaLibero: true,
  }
}

/** Reinicia contadores e vínculos para um novo set (RG-SUB-014); mantém impedimentos de partida. */
export function iniciarNovoSet(estado: EstadoEquipe, formacaoInicial: Formacao): EstadoEquipe {
  return {
    ...estado,
    emQuadra: [...formacaoInicial],
    titularesSet: [...formacaoInicial],
    substituidoPorLibero: null,
    regulares: 0,
    excepcionais: 0,
    pares: [],
    jaEntraramNoSet: [],
    expulsosNoSet: [],
    pedidoNaInterrupcao: false,
    rallyConcluidoDesdeTrocaLibero: true,
  }
}

export function ehLibero(estado: EstadoEquipe, jogador: number): boolean {
  return estado.liberos.includes(jogador) || estado.liberosIncapazes.includes(jogador)
}

export function liberoEmQuadra(estado: EstadoEquipe): number | null {
  return estado.emQuadra.find((j) => estado.liberos.includes(j)) ?? null
}

export function totalSubstituicoes(estado: EstadoEquipe): number {
  return estado.regulares + estado.excepcionais
}

/** Um rally foi concluído: libera nova troca de líbero (RG-LIB-005) e novo pedido de substituição (RG-SUB-007). */
export function registrarRallyConcluido(estado: EstadoEquipe): EstadoEquipe {
  return { ...estado, rallyConcluidoDesdeTrocaLibero: true, pedidoNaInterrupcao: false }
}

/** Jogador impedido de atuar neste momento (expulso no set, desqualificado, lesionado sem retorno). */
export function jogadorImpedido(estado: EstadoEquipe, jogador: number): boolean {
  return (
    estado.expulsosNoSet.includes(jogador) ||
    estado.desqualificados.includes(jogador) ||
    estado.semRetorno.includes(jogador) ||
    estado.liberosIncapazes.includes(jogador)
  )
}

/** Jogadores de linha aptos a atuar (exclui líberos, expulsos, desqualificados e sem retorno). */
export function jogadoresAptos(estado: EstadoEquipe): number[] {
  return estado.elenco.filter((j) => !ehLibero(estado, j) && !jogadorImpedido(estado, j))
}

/** Troca `sai` por `entra` na formação em quadra (mantém a posição). */
export function substituirNaQuadra(estado: EstadoEquipe, sai: number, entra: number): number[] {
  return estado.emQuadra.map((j) => (j === sai ? entra : j))
}
