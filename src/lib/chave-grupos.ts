import { calcularClassificacao, criteriosComConfrontoDireto, faseContaNaClassificacao, type PartidaClassificacao } from '@/lib/classificacao'
import { perdedoresDasSemifinais, vencedoresDosAlimentadores, type PartidaDecisao } from '@/lib/resultado-partida'

export type GrupoRanqueado = { id: number; ordem: number; classificados: number[] }
export type ConfrontoChave = { fase: string; rodada: number; equipeAId: number; equipeBId: number }
export type RodadaChave = { fase: string; slots: number }
export type PartidaChave = PartidaDecisao & { fase: string; rodada: number }

const TERCEIRO = 'TERCEIRO_LUGAR'

export function ranquearGrupo(equipeIds: number[], partidas: PartidaClassificacao[], limite: number) {
  const ids = new Set(equipeIds.map((id) => Number(id)))
  const linhas = calcularClassificacao({
    times: equipeIds.map((equipeId) => ({ equipeId: Number(equipeId), categoriaCampeonatoId: 'grupo' })),
    partidas: partidas
      .filter((partida) => ids.has(Number(partida.equipeAId)) && ids.has(Number(partida.equipeBId)) && faseContaNaClassificacao(partida.fase))
      .map((partida) => ({ ...partida, categoriaCampeonatoId: 'grupo' })),
    regras: { grupo: { criterios: criteriosComConfrontoDireto() } },
  })
  return linhas.map((linha) => linha.equipeId).slice(0, Math.max(0, limite))
}

export function cruzarGrupos(grupos: GrupoRanqueado[]) {
  const ordenados = [...grupos]
    .map((grupo) => ({ ...grupo, classificados: grupo.classificados.map(Number).filter((id) => Number.isInteger(id)) }))
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id)
  const pares = ordenados.filter((grupo) => grupo.classificados.length >= 2)
  if (pares.length >= 2) {
    const jogos: Array<{ rodada: number; equipeAId: number; equipeBId: number }> = []
    const usado = new Set<number>()
    let rodada = 1
    for (let indice = 0; indice + 1 < pares.length; indice += 2) {
      const primeiro = pares[indice].classificados
      const segundo = pares[indice + 1].classificados
      jogos.push({ rodada: rodada++, equipeAId: primeiro[0], equipeBId: segundo[1] })
      jogos.push({ rodada: rodada++, equipeAId: segundo[0], equipeBId: primeiro[1] })
      usado.add(pares[indice].id)
      usado.add(pares[indice + 1].id)
    }
    const sobra = ordenados.filter((grupo) => !usado.has(grupo.id)).flatMap((grupo) => grupo.classificados)
    if (sobra.length >= 2) {
      for (const jogo of chavePorPosicao(sobra)) jogos.push({ ...jogo, rodada: rodada++ })
    }
    return jogos
  }
  return chavePorPosicao(ordenados.flatMap((grupo) => grupo.classificados))
}

export function chavePorPosicao(ordenados: number[]) {
  const lista = ordenados.map(Number).filter((id, indice, todos) => Number.isInteger(id) && todos.indexOf(id) === indice)
  if (lista.length < 2 || lista.length % 2 !== 0) return []
  const jogos: Array<{ rodada: number; equipeAId: number; equipeBId: number }> = []
  for (let indice = 0; indice < lista.length / 2; indice += 1) {
    jogos.push({
      rodada: indice + 1,
      equipeAId: lista[indice],
      equipeBId: lista[lista.length - 1 - indice],
    })
  }
  return jogos
}

export function montarConfrontosAutomaticos(input: {
  grupos: GrupoRanqueado[]
  faseInicial: string
  rounds: RodadaChave[]
  disputaTerceiro: boolean
  existentes: Array<{ fase: string; rodada: number }>
  partidas: PartidaChave[]
}): ConfrontoChave[] {
  const ocupado = (fase: string, rodada: number) => input.existentes.some((item) => item.fase === fase && Number(item.rodada) === rodada)
  const criados: ConfrontoChave[] = []
  const primeira = input.rounds[0]
  if (primeira && primeira.fase === input.faseInicial) {
    for (const jogo of cruzarGrupos(input.grupos)) {
      if (jogo.rodada > primeira.slots || ocupado(primeira.fase, jogo.rodada)) continue
      if (jogo.equipeAId === jogo.equipeBId) continue
      criados.push({ fase: primeira.fase, ...jogo })
    }
  }

  const conhecidas = [...input.partidas, ...criados.map((jogo) => ({
    fase: jogo.fase,
    rodada: jogo.rodada,
    status: 'AGENDADA',
    equipeAId: jogo.equipeAId,
    equipeBId: jogo.equipeBId,
    setsPorA: null,
    setsPorB: null,
    vencedorId: null,
  }))]

  for (let indice = 1; indice < input.rounds.length; indice += 1) {
    const rodada = input.rounds[indice]
    const anterior = input.rounds[indice - 1]
    for (let slot = 1; slot <= rodada.slots; slot += 1) {
      if (ocupado(rodada.fase, slot) || criados.some((jogo) => jogo.fase === rodada.fase && jogo.rodada === slot)) continue
      const alimentadores = conhecidas.filter((partida) => partida.fase === anterior.fase && [slot * 2 - 1, slot * 2].includes(Number(partida.rodada)))
      const vencedores = vencedoresDosAlimentadores(alimentadores, slot)
      if (!vencedores || vencedores[0] === vencedores[1]) continue
      criados.push({ fase: rodada.fase, rodada: slot, equipeAId: vencedores[0], equipeBId: vencedores[1] })
      conhecidas.push({
        fase: rodada.fase,
        rodada: slot,
        status: 'AGENDADA',
        equipeAId: vencedores[0],
        equipeBId: vencedores[1],
        setsPorA: null,
        setsPorB: null,
        vencedorId: null,
      })
    }
  }

  const temSemi = input.rounds.some((rodada) => rodada.fase === 'SEMIFINAL')
  if (input.disputaTerceiro && temSemi && !ocupado(TERCEIRO, 1) && !criados.some((jogo) => jogo.fase === TERCEIRO)) {
    const semis = conhecidas.filter((partida) => partida.fase === 'SEMIFINAL' && (Number(partida.rodada) === 1 || Number(partida.rodada) === 2))
    const perdedores = perdedoresDasSemifinais(semis)
    if (perdedores && perdedores[0] !== perdedores[1]) {
      criados.push({ fase: TERCEIRO, rodada: 1, equipeAId: perdedores[0], equipeBId: perdedores[1] })
    }
  }

  return criados
}
