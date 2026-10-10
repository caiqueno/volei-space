import { inteiroDeSets } from '@/lib/sets-por-fase'

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
 * O set 1 é a escolha da mesa. Os sets do meio alternam com quem não sacou
 * no set anterior. O último set da fase, quando ela tem mais de um set, sai
 * de um sorteio novo. Melhor de 3 sorteia o 3º; melhor de 5 sorteia o 5º.
 * A quantidade é a da fase, já resolvida por `setsDaFase`.
 */
export function modoSaqueInicial(setNumero: number, setsDaFase: number | null | undefined = 3): ModoSaqueInicial {
  const quantidade = inteiroDeSets(setsDaFase) ?? 3
  if (!Number.isInteger(setNumero) || setNumero <= 1) return 'escolha'
  if (quantidade > 1 && setNumero >= quantidade) return 'sorteio'
  if (setNumero > 1 && setNumero < quantidade) return 'alternancia'
  return 'escolha'
}

export function ladoOposto(lado: LadoSaque): LadoSaque {
  return lado === 'teamA' ? 'teamB' : 'teamA'
}

export function saqueObrigatorio(
  setNumero: number,
  saqueAnterior: LadoSaque | null | undefined,
  setsDaFase: number | null | undefined = 3,
): LadoSaque | null {
  if (modoSaqueInicial(setNumero, setsDaFase) !== 'alternancia') return null
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
  setsDaFase: number | null | undefined = 3,
): string | null {
  const quantidade = inteiroDeSets(setsDaFase) ?? 3
  const saques = extrairSaquesIniciais(ocorrencias, equipes)
  for (let set = 2; set < quantidade; set += 1) {
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
