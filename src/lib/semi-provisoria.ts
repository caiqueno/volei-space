import { cruzarGrupos } from '@/lib/chave-grupos'
import { ehRodadaDeVolta, RODADA_VOLTA } from '@/lib/ida-volta'
import { lerOrigemVaga } from '@/lib/vaga-a-definir'

export type LinhaProvisoria = {
  posicao: number
  equipeId: number
  equipe: string
  logoUrl?: string | null
  corHex?: string | null
}

export type GrupoProvisorio = {
  nome: string
  vagas: number
  linhas: LinhaProvisoria[]
}

export type LadoChave = {
  id: number
  nome: string
  corHex: string | null
  logoUrl: string | null
  vaga?: boolean
  provisorio?: boolean
  origem?: string | null
}

type PartidaChave = {
  equipeA: LadoChave
  equipeB: LadoChave
}

type SlotChave = {
  rodada: number
  partida: PartidaChave | null
}

type RodadaChave = {
  fase: string
  slots: SlotChave[]
}

/** Só a tela. A vaga gravada continua vazia até o servidor preenchê-la. */
export function comTimesProvisorios<T extends RodadaChave>(rounds: readonly T[], grupos: readonly GrupoProvisorio[]): T[] {
  if (rounds.length === 0 || grupos.length === 0) return rounds as T[]
  const cruzamento = mapaDoCruzamento(grupos)
  let mudou = false
  const proximos = rounds.map((round) => {
    if (String(round.fase).toUpperCase() !== 'SEMIFINAL') return round
    let slotMudou = false
    const slots = round.slots.map((slot) => {
      if (!slot.partida) return slot
      const partida = preencherPartida(slot.partida, Number(slot.rodada), grupos, cruzamento)
      if (partida === slot.partida) return slot
      slotMudou = true
      return { ...slot, partida }
    })
    if (!slotMudou) return round
    mudou = true
    return { ...round, slots }
  })
  return (mudou ? proximos : rounds) as T[]
}

function preencherPartida(
  partida: PartidaChave,
  rodada: number,
  grupos: readonly GrupoProvisorio[],
  cruzamento: Map<number, { a: number; b: number }>,
) {
  const aAberto = vagaAberta(partida.equipeA)
  const bAberto = vagaAberta(partida.equipeB)
  if (!aAberto && !bAberto) return partida
  const propostaA = aAberto ? resolverLado(partida.equipeA, 'A', rodada, grupos, cruzamento) : null
  const propostaB = bAberto ? resolverLado(partida.equipeB, 'B', rodada, grupos, cruzamento) : null
  let ladoA = partida.equipeA
  let ladoB = partida.equipeB
  if (propostaA && propostaA.id !== ladoB.id) ladoA = propostaA
  if (propostaB && propostaB.id !== ladoA.id) ladoB = propostaB
  if (ladoA === partida.equipeA && ladoB === partida.equipeB) return partida
  return { ...partida, equipeA: ladoA, equipeB: ladoB }
}

function resolverLado(
  atual: LadoChave,
  lado: 'A' | 'B',
  rodada: number,
  grupos: readonly GrupoProvisorio[],
  cruzamento: Map<number, { a: number; b: number }>,
): LadoChave | null {
  const origem = lerOrigemVaga(atual.nome)
  if (origem?.tipo === 'grupo') {
    const grupo = acharGrupo(grupos, origem.grupo)
    return grupo ? timeNaPosicao(grupo, origem.posicao) : null
  }
  if (origem) return null
  const base = ehRodadaDeVolta(rodada) ? rodada - RODADA_VOLTA : rodada
  const jogo = cruzamento.get(base)
  if (!jogo) return null
  const ida = !ehRodadaDeVolta(rodada)
  const id = lado === 'A' ? (ida ? jogo.a : jogo.b) : (ida ? jogo.b : jogo.a)
  const achado = linhaPorId(grupos, id)
  if (!achado) return null
  return timeDe(achado.linha, achado.grupo.nome, achado.linha.posicao)
}

function mapaDoCruzamento(grupos: readonly GrupoProvisorio[]) {
  const comPar = grupos.filter((grupo) => classificados(grupo).length >= 2)
  if (comPar.length < 2) return new Map<number, { a: number; b: number }>()
  const jogos = cruzarGrupos(grupos.map((grupo, indice) => ({
    id: indice + 1,
    ordem: indice + 1,
    classificados: classificados(grupo).map((linha) => linha.equipeId),
  })))
  return new Map(jogos.map((jogo) => [jogo.rodada, { a: jogo.equipeAId, b: jogo.equipeBId }]))
}

function classificados(grupo: GrupoProvisorio) {
  const limite = Math.max(0, Number(grupo.vagas) || 0)
  const vistos = new Set<number>()
  return [...grupo.linhas]
    .filter((linha) => Number.isInteger(linha.posicao) && linha.posicao >= 1 && linha.posicao <= limite && Number.isInteger(linha.equipeId) && linha.equipeId > 0)
    .sort((a, b) => a.posicao - b.posicao || a.equipeId - b.equipeId)
    .filter((linha) => {
      if (vistos.has(linha.posicao)) return false
      vistos.add(linha.posicao)
      return true
    })
}

function timeNaPosicao(grupo: GrupoProvisorio, posicao: number) {
  const linha = classificados(grupo).find((item) => item.posicao === posicao)
  return linha ? timeDe(linha, grupo.nome, posicao) : null
}

function timeDe(linha: LinhaProvisoria, grupo: string, posicao: number): LadoChave {
  return {
    id: linha.equipeId,
    nome: linha.equipe,
    corHex: linha.corHex ?? null,
    logoUrl: linha.logoUrl ?? null,
    vaga: false,
    provisorio: true,
    origem: `${posicao}º ${grupo}`,
  }
}

function acharGrupo(grupos: readonly GrupoProvisorio[], nome: string) {
  const alvo = nome.trim().toLocaleLowerCase('pt-BR')
  return grupos.find((grupo) => grupo.nome.trim().toLocaleLowerCase('pt-BR') === alvo) ?? null
}

function linhaPorId(grupos: readonly GrupoProvisorio[], id: number) {
  for (const grupo of grupos) {
    const linha = classificados(grupo).find((item) => item.equipeId === id)
    if (linha) return { linha, grupo }
  }
  return null
}

function vagaAberta(lado?: { id?: number; vaga?: boolean } | null) {
  if (!lado || lado.vaga) return true
  const id = Number(lado.id)
  return !Number.isInteger(id) || id <= 0
}
