const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_QUE_TRAVA_GRUPO = new Set(['EM_ANDAMENTO', 'ENCERRADA', 'WO'])

export type LeituraCategoria = { id: string } | { id: null } | { erro: string }

export function lerIdCategoria(valor: string | null | undefined): LeituraCategoria {
  const texto = String(valor ?? '').trim()
  if (!texto) return { id: null }
  if (!UUID.test(texto)) return { erro: 'Selecione uma categoria do campeonato.' }
  return { id: texto }
}

export function categoriaDaUrl(params: { get(nome: string): string | null }): LeituraCategoria {
  return lerIdCategoria(params.get('categoriaCampeonatoId') || params.get('categoria'))
}

export function escolherCategoria(pedida: string | null | undefined, categorias: { id: string }[]): string | null {
  if (categorias.length === 0) return null
  const lida = lerIdCategoria(pedida)
  if ('id' in lida && lida.id && categorias.some((item) => item.id === lida.id)) return lida.id
  return categorias[0].id
}

export type EquipeEscopo = { id: number; categoriaCampeonatoId?: string | null }

export type EscopoGeracao =
  | { tipo: 'categoria'; id: string }
  | { tipo: 'legado' }
  | { tipo: 'erro'; mensagem: string }

/** Sem id e sem categoria nas equipes, o campeonato antigo continua inteiro. Com categorias, a geração precisa de uma só. */
export function escopoDaGeracao(equipes: EquipeEscopo[], categoriaInformada: string | null | undefined): EscopoGeracao {
  const informada = lerIdCategoria(categoriaInformada)
  if ('erro' in informada) return { tipo: 'erro', mensagem: informada.erro }
  if (informada.id) return { tipo: 'categoria', id: informada.id }

  const ids = new Set(equipes.map((equipe) => equipe.categoriaCampeonatoId).filter((id): id is string => Boolean(id)))
  if (ids.size === 0) return { tipo: 'legado' }
  if (ids.size === 1 && equipes.every((equipe) => equipe.categoriaCampeonatoId === Array.from(ids)[0])) {
    return { tipo: 'categoria', id: Array.from(ids)[0] }
  }
  return { tipo: 'erro', mensagem: 'Escolha a categoria antes de gerar grupos, calendário ou chave.' }
}

export function equipesDaCategoria<T extends EquipeEscopo>(equipes: T[], categoriaId: string): T[] {
  return equipes.filter((equipe) => equipe.categoriaCampeonatoId === categoriaId)
}

export type PartidaEscopo = {
  id?: number
  categoriaCampeonatoId?: string | null
  fase?: string | null
  grupoId?: number | null
  status?: string | null
}

export function partidasDeGrupoDaCategoria<T extends PartidaEscopo>(partidas: T[], categoriaId: string): T[] {
  return partidas.filter((partida) => (
    partida.categoriaCampeonatoId === categoriaId
    && (String(partida.fase ?? '').toUpperCase() === 'GRUPOS' || partida.grupoId != null)
  ))
}

export function regeneracaoBloqueada(partidas: PartidaEscopo[], categoriaId: string) {
  return partidasDeGrupoDaCategoria(partidas, categoriaId).some((partida) => (
    STATUS_QUE_TRAVA_GRUPO.has(String(partida.status ?? '').toUpperCase())
  ))
}

export function partidaForaDaCategoria(partidas: { categoriaCampeonatoId?: string | null }[], categoriaId: string) {
  return partidas.some((partida) => partida.categoriaCampeonatoId !== categoriaId)
}

export function gruposDeConfronto<T extends { categoriaCampeonatoId?: string | null }>(equipes: T[]): T[][] {
  const mapa = new Map<string, T[]>()
  for (const equipe of equipes) {
    const chave = equipe.categoriaCampeonatoId ?? ''
    const lista = mapa.get(chave) ?? []
    lista.push(equipe)
    mapa.set(chave, lista)
  }
  return Array.from(mapa.values())
}

export function paresDentroDosGrupos<T extends { id: number; categoriaCampeonatoId?: string | null }>(equipes: T[]) {
  const pares: Array<{ a: T; b: T }> = []
  for (const grupo of gruposDeConfronto(equipes)) {
    for (let i = 0; i < grupo.length; i += 1) {
      for (let j = i + 1; j < grupo.length; j += 1) pares.push({ a: grupo[i], b: grupo[j] })
    }
  }
  return pares
}

export function confrontoRepetidoNaCategoria(
  existentes: { categoriaCampeonatoId?: string | null; fase?: string | null; rodada?: number | null }[],
  categoriaId: string,
  fase: string,
  rodada: number,
) {
  return existentes.some((item) => (
    item.categoriaCampeonatoId === categoriaId
    && String(item.fase ?? '').toUpperCase() === fase.toUpperCase()
    && Number(item.rodada) === rodada
  ))
}
