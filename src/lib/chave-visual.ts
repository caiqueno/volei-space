export type JogoColuna = { rodada: number; avancou: boolean }

export type ColunaVisual = {
  id: string
  lado: 'esquerda' | 'centro' | 'direita'
  rotulo: string
  fase: string
  jogos: JogoColuna[]
}

export type TrechoConector = {
  x1: number
  y1: number
  x2: number
  y2: number
  ouro: boolean
}

/** Largura relativa da coluna de jogos e do vão do conector. O vão não usa px fixo. */
export const PESO_JOGO = 1
export const PESO_TRACO = 0.16

type RodadaVisual = { fase: string; label: string; slots: JogoColuna[] }

/** Colunas simétricas: fases externas nas pontas e a final no centro. */
export function colunasSimetricas(rounds: RodadaVisual[]): ColunaVisual[] {
  const final = rounds.find((round) => round.fase === 'FINAL') ?? null
  const laterais = rounds.filter((round) => round.fase !== 'FINAL')
  const esquerda = laterais.map((round) => coluna(round, 'esquerda'))
  const direita = [...laterais].reverse().map((round) => coluna(round, 'direita'))
  const centro = final ? [coluna(final, 'centro')] : []
  return [...esquerda, ...centro, ...direita]
}

export function abasDaChave(rounds: { fase: string; label: string }[]) {
  return rounds.map((round) => ({ id: round.fase, rotulo: round.label }))
}

/** Grade com vão entre as colunas, na mesma proporção dos traços. */
export function gradeDaChave(quantidade: number) {
  const partes: string[] = []
  for (let indice = 0; indice < quantidade; indice += 1) {
    if (indice > 0) partes.push(`${PESO_TRACO}fr`)
    partes.push('minmax(0,1fr)')
  }
  return partes.join(' ')
}

/** Traços em L, em porcentagem do quadro, a partir da quantidade de jogos de cada coluna. */
export function trechosConectores(colunas: ColunaVisual[]): TrechoConector[] {
  const total = colunas.length
  if (total < 2) return []
  const trechos: TrechoConector[] = []
  for (let indice = 0; indice < total - 1; indice += 1) {
    const esquerda = colunas[indice]
    const direita = colunas[indice + 1]
    const par = parDeColunas(esquerda, direita)
    if (!par) continue
    const { fonte, alvo, sentido } = par
    const fonteIndice = colunas.indexOf(fonte)
    const alvoIndice = colunas.indexOf(alvo)
    fonte.jogos.forEach((jogo, ordem) => {
      const pai = Math.ceil(jogo.rodada / 2)
      const destino = alvo.jogos.findIndex((item) => item.rodada === pai)
      if (destino < 0) return
      const y1 = centroVertical(ordem, fonte.jogos.length)
      const y2 = centroVertical(destino, alvo.jogos.length)
      const x1 = sentido === 'direita' ? bordaDireita(fonteIndice, total) : bordaEsquerda(fonteIndice, total)
      const x2 = sentido === 'direita' ? bordaEsquerda(alvoIndice, total) : bordaDireita(alvoIndice, total)
      trechos.push({ x1, y1, x2, y2, ouro: jogo.avancou })
    })
  }
  return trechos
}

function bordaEsquerda(indice: number, quantidade: number) {
  return (indice * (PESO_JOGO + PESO_TRACO)) / larguraTotal(quantidade) * 100
}

function bordaDireita(indice: number, quantidade: number) {
  return (indice * (PESO_JOGO + PESO_TRACO) + PESO_JOGO) / larguraTotal(quantidade) * 100
}

function larguraTotal(quantidade: number) {
  return quantidade * PESO_JOGO + Math.max(0, quantidade - 1) * PESO_TRACO
}

export function caminhoConector(trecho: TrechoConector) {
  const meio = (trecho.x1 + trecho.x2) / 2
  return `M${trecho.x1},${trecho.y1} H${meio} V${trecho.y2} H${trecho.x2}`
}

function coluna(round: RodadaVisual, lado: ColunaVisual['lado']): ColunaVisual {
  const corte = Math.ceil(round.slots.length / 2)
  const jogos = lado === 'direita'
    ? round.slots.filter((slot) => slot.rodada > corte)
    : lado === 'esquerda'
      ? round.slots.filter((slot) => slot.rodada <= corte)
      : round.slots
  return { id: `${round.fase}-${lado}`, lado, rotulo: round.label, fase: round.fase, jogos }
}

function centroVertical(ordem: number, quantidade: number) {
  if (quantidade <= 0) return 50
  return ((ordem + 0.5) / quantidade) * 100
}

function parDeColunas(esquerda: ColunaVisual, direita: ColunaVisual) {
  if (esquerda.lado === 'esquerda') return { fonte: esquerda, alvo: direita, sentido: 'direita' as const }
  if (direita.lado === 'direita') return { fonte: direita, alvo: esquerda, sentido: 'esquerda' as const }
  return null
}
