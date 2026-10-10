import { vencedorDaPartida, perdedorDaPartida } from '@/lib/resultado-partida'

export const MENSAGEM_SUMULA_SEM_TIMES =
  'A súmula não pode iniciar enquanto os times não estiverem definidos.'

export type OrigemGrupo = { tipo: 'grupo'; posicao: number; grupo: string }
export type OrigemSemi = { tipo: 'vencedor' | 'perdedor'; rodada: number }
export type OrigemVaga = OrigemGrupo | OrigemSemi

export type JogoVaga = {
  id: number
  fase: string
  rodada: number
  status?: string | null
  equipeAId: number | null
  equipeBId: number | null
  origemVagaA: string | null
  origemVagaB: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  vencedorId?: number | null
}

export type GrupoClassificado = { nome: string; classificados: number[] }

const SEMI = /^(Vencedor|Perdedor) Semi (\d+)$/i
const GRUPO = /^(\d+)º\s+(.+)$/

export function lerOrigemVaga(valor: unknown): OrigemVaga | null {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim()
  const semi = SEMI.exec(texto)
  if (semi) {
    const rodada = Number(semi[2])
    if (!Number.isInteger(rodada) || rodada < 1) return null
    return { tipo: semi[1].toLowerCase() === 'vencedor' ? 'vencedor' : 'perdedor', rodada }
  }
  const grupo = GRUPO.exec(texto)
  if (!grupo) return null
  const posicao = Number(grupo[1])
  const nome = grupo[2].trim()
  if (!Number.isInteger(posicao) || posicao < 1 || !nome) return null
  return { tipo: 'grupo', posicao, grupo: nome }
}

export function rotuloValido(valor: unknown): string | null {
  const origem = lerOrigemVaga(valor)
  if (!origem) return null
  return origem.tipo === 'grupo'
    ? `${origem.posicao}º ${origem.grupo}`
    : `${origem.tipo === 'vencedor' ? 'Vencedor' : 'Perdedor'} Semi ${origem.rodada}`
}

export function timesDefinidos(partida: { equipeAId?: number | null; equipeBId?: number | null }) {
  const a = Number(partida.equipeAId)
  const b = Number(partida.equipeBId)
  return Number.isInteger(a) && a > 0 && Number.isInteger(b) && b > 0
}

export function ladoExposto(equipe: unknown, origem: unknown) {
  const item = (Array.isArray(equipe) ? equipe[0] : equipe) as { id?: number; nome?: string; corHex?: string | null; logoUrl?: string | null; jogadores?: unknown } | null
  if (item?.id) {
    return { ...item, id: Number(item.id), nome: item.nome ?? 'Equipe', corHex: item.corHex ?? null, vaga: false }
  }
  const rotulo = rotuloValido(origem)
  if (!rotulo) return null
  return { id: 0, nome: rotulo, corHex: null, logoUrl: null, vaga: true }
}

export function textoDoLado(equipe?: { nome?: string | null; vaga?: boolean } | null, vazio = 'A definir') {
  if (equipe?.vaga && equipe.nome) return equipe.nome
  const nome = String(equipe?.nome ?? '').trim()
  return nome || vazio
}

export function rotuloDoLado(equipe: unknown, origem: unknown, vazio = 'Equipe') {
  const item = (Array.isArray(equipe) ? equipe[0] : equipe) as { nome?: string | null } | null
  const nome = String(item?.nome ?? '').trim()
  if (nome) return nome
  return rotuloValido(origem) ?? vazio
}

export function encontrarPartidaDaVaga<T>(
  partidas: readonly T[],
  fase: string,
  rodada: number,
  categoriaCampeonatoId?: string | null,
): T | null {
  const faseAlvo = String(fase ?? '').toUpperCase()
  const comoVaga = (partida: T) => partida as T & { fase?: string | null; rodada?: number | null; categoriaCampeonatoId?: string | null }
  const candidatos = partidas.filter((partida) => {
    const item = comoVaga(partida)
    return String(item.fase ?? '').toUpperCase() === faseAlvo && Number(item.rodada) === Number(rodada)
  })
  if (categoriaCampeonatoId) {
    return candidatos.find((partida) => comoVaga(partida).categoriaCampeonatoId === categoriaCampeonatoId) ?? null
  }
  if (candidatos.length === 0) return null
  const categorias = new Set(candidatos.map((partida) => comoVaga(partida).categoriaCampeonatoId).filter((id): id is string => Boolean(id)))
  if (categorias.size > 1) return null
  return candidatos[0]
}

export function sugerirVagasSemifinal(grupos: string[], disputaTerceiro: boolean) {
  const nomes = grupos.map((nome) => nome.trim()).filter(Boolean)
  const primeiro = nomes[0] || 'Grupo A'
  const segundo = nomes[1] || 'Grupo B'
  const jogos = [
    { fase: 'SEMIFINAL', rodada: 1, origemVagaA: `1º ${primeiro}`, origemVagaB: `2º ${segundo}` },
    { fase: 'SEMIFINAL', rodada: 2, origemVagaA: `1º ${segundo}`, origemVagaB: `2º ${primeiro}` },
    { fase: 'FINAL', rodada: 1, origemVagaA: 'Vencedor Semi 1', origemVagaB: 'Vencedor Semi 2' },
  ]
  if (disputaTerceiro) {
    jogos.push({ fase: 'TERCEIRO_LUGAR', rodada: 1, origemVagaA: 'Perdedor Semi 1', origemVagaB: 'Perdedor Semi 2' })
  }
  return jogos
}

function grupoDaOrigem(grupos: GrupoClassificado[], nome: string) {
  const alvo = nome.trim().toLocaleLowerCase('pt-BR')
  return grupos.find((grupo) => grupo.nome.trim().toLocaleLowerCase('pt-BR') === alvo) ?? null
}

function idDaOrigem(
  origem: OrigemVaga,
  jogos: JogoVaga[],
  grupos: GrupoClassificado[],
  gruposEncerrados: boolean,
) {
  if (origem.tipo === 'grupo') {
    if (!gruposEncerrados) return null
    const grupo = grupoDaOrigem(grupos, origem.grupo)
    const id = Number(grupo?.classificados[origem.posicao - 1])
    return Number.isInteger(id) && id > 0 ? id : null
  }
  const semi = jogos.find((jogo) => jogo.fase === 'SEMIFINAL' && Number(jogo.rodada) === origem.rodada)
  if (!semi || !timesDefinidos(semi)) return null
  const decidida = { ...semi, equipeAId: Number(semi.equipeAId), equipeBId: Number(semi.equipeBId) }
  const id = origem.tipo === 'vencedor' ? vencedorDaPartida(decidida) : perdedorDaPartida(decidida)
  return id != null && id > 0 ? id : null
}

export function aplicarVagas(input: {
  jogos: JogoVaga[]
  gruposEncerrados: boolean
  grupos: GrupoClassificado[]
}): Array<{ id: number; equipeAId?: number; equipeBId?: number }> {
  const jogos = input.jogos.map((jogo) => ({ ...jogo }))
  const patches = new Map<number, { id: number; equipeAId?: number; equipeBId?: number }>()

  function preencher(tipos: Array<OrigemVaga['tipo']>) {
    for (const jogo of jogos) {
      for (const lado of ['A', 'B'] as const) {
        const atual = lado === 'A' ? jogo.equipeAId : jogo.equipeBId
        if (atual != null && Number(atual) > 0) continue
        const origem = lerOrigemVaga(lado === 'A' ? jogo.origemVagaA : jogo.origemVagaB)
        if (!origem || !tipos.includes(origem.tipo)) continue
        const id = idDaOrigem(origem, jogos, input.grupos, input.gruposEncerrados)
        if (id == null) continue
        const outro = lado === 'A' ? jogo.equipeBId : jogo.equipeAId
        if (Number(outro) === id) continue
        const patch = patches.get(jogo.id) ?? { id: jogo.id }
        if (lado === 'A') {
          jogo.equipeAId = id
          patch.equipeAId = id
        } else {
          jogo.equipeBId = id
          patch.equipeBId = id
        }
        patches.set(jogo.id, patch)
      }
    }
  }

  preencher(['grupo'])
  preencher(['vencedor', 'perdedor'])
  return Array.from(patches.values())
}
