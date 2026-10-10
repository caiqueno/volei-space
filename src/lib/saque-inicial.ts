export type LadoSaque = 'teamA' | 'teamB'
export type ModoSaqueInicial = 'escolha' | 'alternancia' | 'sorteio'

export type OcorrenciaSaque = {
  tipo?: string | null
  descricao?: string | null
  set?: number | null
}

export type NomesEquipeSaque = {
  teamA: string
  teamB: string
}

/**
 * Set 1 é escolha. Sets 2, 3 e 4 alternam com o set anterior.
 * O 5º set é tie-break e sai de um sorteio novo.
 */
export function modoSaqueInicial(setNumero: number): ModoSaqueInicial {
  if (!Number.isInteger(setNumero) || setNumero <= 1) return 'escolha'
  if (setNumero >= 5) return 'sorteio'
  return 'alternancia'
}

export function ladoOposto(lado: LadoSaque): LadoSaque {
  return lado === 'teamA' ? 'teamB' : 'teamA'
}

export function saqueObrigatorio(setNumero: number, saqueAnterior: LadoSaque | null | undefined): LadoSaque | null {
  if (modoSaqueInicial(setNumero) !== 'alternancia') return null
  if (saqueAnterior !== 'teamA' && saqueAnterior !== 'teamB') return null
  return ladoOposto(saqueAnterior)
}

export function sortearLado(aleatorio: number): LadoSaque {
  return aleatorio < 0.5 ? 'teamA' : 'teamB'
}

export function marcarSaqueInicial(lado: LadoSaque, agora = Date.now()) {
  return `[[SAQUE:${agora}:${lado}]]`
}

export function extrairSaquesIniciais(
  ocorrencias: OcorrenciaSaque[] | null | undefined,
  equipes: NomesEquipeSaque,
): Partial<Record<number, LadoSaque>> {
  const melhores = new Map<number, { lado: LadoSaque; timestamp: number; indice: number }>()

  ;(ocorrencias ?? []).forEach((ocorrencia, indice) => {
    const descricao = String(ocorrencia.descricao ?? '')
    const normalizada = normalizar(descricao)
    if (!normalizada.includes('comeca sacando')) return

    const set = Math.max(1, Number(ocorrencia.set ?? 1) || 1)
    const marca = descricao.match(/\[\[SAQUE:(\d+):(teamA|teamB)\]\]/)
    const rotacao = descricao.match(/\[\[ROT:(\d+):(teamA|teamB):/)
    const ladoMarca = marca?.[2] as LadoSaque | undefined
    const ladoRotacao = rotacao?.[2] as LadoSaque | undefined
    const ladoNome = ladoPeloNome(normalizada, equipes)
    const lado = ladoMarca ?? ladoRotacao ?? ladoNome
    if (lado !== 'teamA' && lado !== 'teamB') return

    const timestamp = marca ? Number(marca[1]) : rotacao ? Number(rotacao[1]) : 0
    const atual = melhores.get(set)
    const maisRecente = !atual
      || timestamp > atual.timestamp
      || (timestamp === atual.timestamp && indice < atual.indice)
    if (maisRecente) melhores.set(set, { lado, timestamp, indice })
  })

  const resultado: Partial<Record<number, LadoSaque>> = {}
  melhores.forEach((valor, set) => {
    resultado[set] = valor.lado
  })
  return resultado
}

export function validarSaquesIniciais(
  ocorrencias: OcorrenciaSaque[] | null | undefined,
  equipes: NomesEquipeSaque,
): string | null {
  const saques = extrairSaquesIniciais(ocorrencias, equipes)
  for (const set of [2, 3, 4]) {
    const atual = saques[set]
    if (!atual) continue
    const anterior = saques[set - 1]
    if (anterior !== 'teamA' && anterior !== 'teamB') {
      return `O saque inicial do set ${set} foi registrado sem o saque do set ${set - 1}.`
    }
    if (atual !== ladoOposto(anterior)) {
      return `No set ${set} o saque inicial é de quem não sacou no set ${set - 1}.`
    }
  }
  return null
}

function ladoPeloNome(normalizada: string, equipes: NomesEquipeSaque): LadoSaque | null {
  const indice = normalizada.indexOf('comeca sacando')
  const trecho = indice >= 0 ? normalizada.slice(0, indice) : normalizada
  let melhor: { lado: LadoSaque; pos: number; tamanho: number } | null = null
  for (const lado of ['teamA', 'teamB'] as const) {
    const nome = normalizar(equipes[lado])
    if (!nome) continue
    const pos = trecho.lastIndexOf(nome)
    if (pos < 0) continue
    if (!melhor || pos > melhor.pos || (pos === melhor.pos && nome.length > melhor.tamanho)) {
      melhor = { lado, pos, tamanho: nome.length }
    }
  }
  return melhor?.lado ?? null
}

function normalizar(valor?: string | null) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
