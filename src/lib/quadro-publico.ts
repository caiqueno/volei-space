export type LinhaGrupo = {
  posicao: number
  equipeId?: number
  equipe: string
  logoUrl?: string | null
  corHex?: string | null
  pontos: number
  jogos: number
  vitorias: number
  derrotas: number
  setsPro: number
  setsContra: number
  saldoSets: number
  pontosPro: number
  pontosContra: number
  saldoPontos: number
  punicoes: number
}

export type AtletaQuadro = {
  jogadorId: number
  nome: string
  equipe: string
  numero: number | null
  ataque: number
  bloqueio: number
  saque: number
  logoUrl?: string | null
  corHex?: string | null
}

export function pontosDoAtleta(atleta: Pick<AtletaQuadro, 'ataque' | 'bloqueio' | 'saque'>) {
  return atleta.ataque + atleta.bloqueio + atleta.saque
}

export function ordenarScouts(atletas: AtletaQuadro[]) {
  return [...atletas].sort((a, b) => (
    pontosDoAtleta(b) - pontosDoAtleta(a)
    || b.ataque - a.ataque
    || b.bloqueio - a.bloqueio
    || b.saque - a.saque
    || a.nome.localeCompare(b.nome, 'pt')
  ))
}

export function topCinco(atletas: AtletaQuadro[], chave: 'ataque' | 'bloqueio' | 'saque') {
  return [...atletas]
    .filter((atleta) => atleta[chave] > 0)
    .sort((a, b) => b[chave] - a[chave] || pontosDoAtleta(b) - pontosDoAtleta(a) || a.nome.localeCompare(b.nome, 'pt'))
    .slice(0, 5)
}

export function liderDaTabela(linhas: LinhaGrupo[]) {
  if (linhas.length === 0) return null
  return [...linhas].sort((a, b) => (
    b.pontos - a.pontos
    || b.vitorias - a.vitorias
    || b.jogos - a.jogos
    || a.equipe.localeCompare(b.equipe, 'pt')
  ))[0]
}

export function saldoComSinal(valor: number) {
  if (valor > 0) return `+${valor}`
  return String(valor)
}

/** As primeiras posições do grupo, até o número de vagas, entram como classificadas. */
export function classificaNaVaga(indice: number, vagas: number) {
  const limite = Number(vagas)
  return Number.isInteger(indice) && indice >= 0 && Number.isFinite(limite) && limite > 0 && indice < limite
}
