export type TotaisAtleta = {
  id: number
  nome: string
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
}

export type MvpDaFinal = {
  jogadorId: number
  nome: string
  equipe: string | null
  fotoRostoUrl: string | null
  fotoUrl: string | null
}

export type MvpDoCampeonato = {
  nome: string
  equipe: string | null
  foto: string | null
  pontos: number
  saque: number
  ataque: number
  bloqueio: number
  origem: 'final' | 'pontos'
}

export type FinalCandidata = {
  id: number
  rodada?: number | null
  categoriaCampeonatoId?: string | null
}

/** Uma final da categoria. Sem categoria, só quando o campeonato não mistura finais de categorias diferentes. */
export function partidaFinalUnica(partidas: FinalCandidata[], categoriaId: string | null) {
  const daCategoria = categoriaId
    ? partidas.filter((item) => item.categoriaCampeonatoId === categoriaId)
    : partidas
  if (daCategoria.length === 0) return null
  if (!categoriaId) {
    const categorias = new Set(daCategoria.map((item) => item.categoriaCampeonatoId).filter(Boolean))
    if (categorias.size > 1) return null
  }
  const rodadaUm = daCategoria.filter((item) => Number(item.rodada ?? 1) === 1)
  const lista = rodadaUm.length > 0 ? rodadaUm : daCategoria
  return lista[0] ?? null
}

export function ordenarPorPontos(totais: TotaisAtleta[]) {
  return [...totais].sort((a, b) => (
    b.pontos - a.pontos
    || b.ataque - a.ataque
    || b.bloqueio - a.bloqueio
    || b.saque - a.saque
    || a.nome.localeCompare(b.nome, 'pt')
  ))
}

/** O MVP gravado na final prevalece. Sem ele, continua o maior total de saque, ataque e bloqueio. */
export function escolherMvpDoCampeonato(totais: TotaisAtleta[], daFinal: MvpDaFinal | null): MvpDoCampeonato | null {
  const nomeFinal = daFinal?.nome.trim()
  if (daFinal && nomeFinal) {
    const stats = totais.find((item) => item.id === daFinal.jogadorId)
    return {
      nome: nomeFinal,
      equipe: texto(daFinal.equipe),
      foto: texto(daFinal.fotoRostoUrl) || texto(daFinal.fotoUrl),
      pontos: stats?.pontos ?? 0,
      saque: stats?.saque ?? 0,
      ataque: stats?.ataque ?? 0,
      bloqueio: stats?.bloqueio ?? 0,
      origem: 'final',
    }
  }
  const lider = ordenarPorPontos(totais)[0]
  if (!lider) return null
  return {
    nome: lider.nome,
    equipe: null,
    foto: null,
    pontos: lider.pontos,
    saque: lider.saque,
    ataque: lider.ataque,
    bloqueio: lider.bloqueio,
    origem: 'pontos',
  }
}

function texto(valor: string | null | undefined) {
  const limpo = valor?.trim()
  return limpo ? limpo : null
}
