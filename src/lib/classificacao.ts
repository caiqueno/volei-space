import { setEstaEncerrado, type RegraSet } from '@/lib/set-encerrado'
import { DEFAULT_CRITERIOS_CLASSIFICACAO } from '@/lib/championship-setup-defaults'

/**
 * Cálculo puro da tabela. A função SQL `recalcular_classificacao_liga` que
 * prevalece depois de `supabase-recalcular-classificacao-liga-atomico.sql`
 * ainda usa 4/3/1/0, mistura o mata-mata e ignora o set já encerrado.
 * O servidor grava o resultado desta função até o banco ser alinhado.
 */

export type FaixasPontos = {
  pontosVencedorMargem1: number
  pontosPerdedorMargem1: number
  pontosVencedorMargem2: number
  pontosPerdedorMargem2: number
}

export const FAIXAS_PADRAO: FaixasPontos = {
  pontosVencedorMargem1: 2,
  pontosPerdedorMargem1: 1,
  pontosVencedorMargem2: 3,
  pontosPerdedorMargem2: 0,
}

const REGRA_SET_PADRAO: RegraSet = {
  setsPorPartida: 3,
  pontosPorSet: 21,
  tieBreakUltimoSet: false,
  pontosUltimoSet: 15,
  diferencaMinimaSet: 2,
}

const CRITERIOS_CONHECIDOS = new Set([
  'PONTOS',
  'VITORIAS',
  'DERROTAS',
  'SALDO_SETS',
  'SALDO_PONTOS',
  'SETS_PRO',
  'PONTOS_PRO',
])

export type TimeClassificacao = {
  equipeId: number
  categoriaCampeonatoId?: string | null
  categoria?: string | null
}

export type SetClassificacao = { numero: number; pontosA: number; pontosB: number }

export type PartidaClassificacao = {
  equipeAId: number
  equipeBId: number
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  status?: string | null
  vencedorId?: number | null
  fase?: string | null
  categoriaCampeonatoId?: string | null
  sumulaAprovadaEm?: string | null
  sumulaSubmetidaEm?: string | null
  sets?: SetClassificacao[] | null
}

export type RegrasCategoria = {
  faixas?: Partial<FaixasPontos> | null
  criterios?: string[] | string | null
  set?: Partial<RegraSet> | null
}

export type LinhaClassificacao = {
  equipeId: number
  categoriaCampeonatoId: string | null
  categoria: string
  posicao: number
  pontos: number
  jogos: number
  vitorias: number
  derrotas: number
  setsPro: number
  setsContra: number
  pontosPro: number
  pontosContra: number
}

type Acumulado = Omit<LinhaClassificacao, 'posicao'>

export function pontosDaMargem(setsPro: number, setsContra: number, faixas: FaixasPontos) {
  const margem = Math.abs(setsPro - setsContra)
  if (margem <= 0) return 0
  const venceu = setsPro > setsContra
  if (margem === 1) return venceu ? faixas.pontosVencedorMargem1 : faixas.pontosPerdedorMargem1
  return venceu ? faixas.pontosVencedorMargem2 : faixas.pontosPerdedorMargem2
}

export function partidaEncerrada(partida: {
  status?: string | null
  sumulaAprovadaEm?: string | null
  sumulaSubmetidaEm?: string | null
  vencedorId?: number | null
}) {
  const status = String(partida.status ?? '').trim().toUpperCase()
  return ['ENCERRADA', 'FINALIZADA', 'FINISHED', 'APROVADA', 'WO'].includes(status)
    || Boolean(partida.sumulaAprovadaEm)
    || Boolean(partida.sumulaSubmetidaEm && partida.vencedorId != null)
}

export function faseContaNaClassificacao(fase?: string | null) {
  const valor = String(fase ?? 'GERAL').trim().toUpperCase()
  return valor === '' || valor === 'GERAL' || valor === 'GRUPOS'
}

export function normalizarCriterios(criterios?: string[] | string | null) {
  const lista = Array.isArray(criterios)
    ? criterios
    : typeof criterios === 'string'
      ? criteriosJson(criterios)
      : []
  const validos = lista
    .map((item) => String(item ?? '').trim().toUpperCase())
    .filter((item) => CRITERIOS_CONHECIDOS.has(item))
  return validos.length > 0 ? validos : [...DEFAULT_CRITERIOS_CLASSIFICACAO]
}

export function calcularClassificacao(input: {
  times: TimeClassificacao[]
  partidas: PartidaClassificacao[]
  regras?: Record<string, RegrasCategoria | null | undefined>
}): LinhaClassificacao[] {
  const times = input.times.map((time) => ({
    equipeId: Number(time.equipeId),
    categoriaCampeonatoId: time.categoriaCampeonatoId ?? null,
    categoria: time.categoria || '',
  }))
  const timePorId = new Map(times.map((time) => [time.equipeId, time]))
  const tabela = new Map<number, Acumulado>()
  for (const time of times) {
    tabela.set(time.equipeId, linhaZerada(time))
  }

  for (const partida of input.partidas) {
    if (!faseContaNaClassificacao(partida.fase) || !partidaEncerrada(partida)) continue
    const categoriaId = categoriaEfetiva(partida, timePorId)
    if (!timesDaCategoria(partida, categoriaId, timePorId)) continue
    const regra = regraDaCategoria(input.regras, categoriaId)
    aplicarPartidaEncerrada(tabela, partida, regra.faixas)
  }

  for (const partida of input.partidas) {
    if (!faseContaNaClassificacao(partida.fase)) continue
    if (String(partida.status ?? '').trim().toUpperCase() !== 'EM_ANDAMENTO') continue
    const categoriaId = categoriaEfetiva(partida, timePorId)
    if (!timesDaCategoria(partida, categoriaId, timePorId)) continue
    const regra = regraDaCategoria(input.regras, categoriaId)
    aplicarSetsAoVivo(tabela, partida, regra.set)
  }

  const porCategoria = new Map<string, Acumulado[]>()
  for (const linha of Array.from(tabela.values())) {
    const chave = linha.categoriaCampeonatoId ?? ''
    const grupo = porCategoria.get(chave) ?? []
    grupo.push(linha)
    porCategoria.set(chave, grupo)
  }

  const ranque: LinhaClassificacao[] = []
  for (const entrada of Array.from(porCategoria.entries())) {
    const chave = entrada[0]
    const linhas = entrada[1]
    const criterios = regraDaCategoria(input.regras, chave || null).criterios
    linhas.sort((esquerda, direita) => comparar(esquerda, direita, criterios))
    linhas.forEach((linha, indice) => ranque.push({ ...linha, posicao: indice + 1 }))
  }
  return ranque.sort((esquerda, direita) => (
    String(esquerda.categoriaCampeonatoId ?? '').localeCompare(String(direita.categoriaCampeonatoId ?? ''))
    || esquerda.posicao - direita.posicao
    || esquerda.equipeId - direita.equipeId
  ))
}

function aplicarPartidaEncerrada(tabela: Map<number, Acumulado>, partida: PartidaClassificacao, faixas: FaixasPontos) {
  const placar = placarOficial(partida)
  const status = String(partida.status ?? '').trim().toUpperCase()
  if (placar.setsA === placar.setsB) {
    if (status !== 'WO' || partida.vencedorId == null) return
    const vencedorId = Number(partida.vencedorId)
    const perdedorId = vencedorId === Number(partida.equipeAId) ? Number(partida.equipeBId) : Number(partida.equipeAId)
    somarLado(tabela, vencedorId, { jogos: 1, vitorias: 1, derrotas: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: faixas.pontosVencedorMargem2 })
    somarLado(tabela, perdedorId, { jogos: 1, vitorias: 0, derrotas: 1, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: faixas.pontosPerdedorMargem2 })
    return
  }

  const lados = [
    lado(Number(partida.equipeAId), placar.setsA, placar.setsB, placar.pontosA, placar.pontosB, faixas),
    lado(Number(partida.equipeBId), placar.setsB, placar.setsA, placar.pontosB, placar.pontosA, faixas),
  ]
  for (const item of lados) somarLado(tabela, item.equipeId, item)
}

function aplicarSetsAoVivo(tabela: Map<number, Acumulado>, partida: PartidaClassificacao, regra: RegraSet) {
  for (const set of partida.sets ?? []) {
    if (!setEstaEncerrado(set, regra)) continue
    const aVenceu = set.pontosA > set.pontosB
    somarLado(tabela, Number(partida.equipeAId), {
      jogos: 0, vitorias: 0, derrotas: 0,
      setsPro: aVenceu ? 1 : 0,
      setsContra: aVenceu ? 0 : 1,
      pontosPro: Number(set.pontosA),
      pontosContra: Number(set.pontosB),
      pontos: 0,
    })
    somarLado(tabela, Number(partida.equipeBId), {
      jogos: 0, vitorias: 0, derrotas: 0,
      setsPro: aVenceu ? 0 : 1,
      setsContra: aVenceu ? 1 : 0,
      pontosPro: Number(set.pontosB),
      pontosContra: Number(set.pontosA),
      pontos: 0,
    })
  }
}

function placarOficial(partida: PartidaClassificacao) {
  const sets = partida.sets ?? []
  if (sets.length > 0) {
    let pontosA = 0
    let pontosB = 0
    let setsA = 0
    let setsB = 0
    for (const set of sets) {
      pontosA += Number(set.pontosA ?? 0)
      pontosB += Number(set.pontosB ?? 0)
      if (Number(set.pontosA) > Number(set.pontosB)) setsA += 1
      else if (Number(set.pontosB) > Number(set.pontosA)) setsB += 1
    }
    if (partida.setsPorA != null && partida.setsPorB != null) {
      setsA = Number(partida.setsPorA)
      setsB = Number(partida.setsPorB)
    }
    return { setsA, setsB, pontosA, pontosB }
  }
  return {
    setsA: Number(partida.setsPorA ?? 0),
    setsB: Number(partida.setsPorB ?? 0),
    pontosA: Number(partida.pontosPorA ?? 0),
    pontosB: Number(partida.pontosPorB ?? 0),
  }
}

function lado(equipeId: number, setsPro: number, setsContra: number, pontosPro: number, pontosContra: number, faixas: FaixasPontos) {
  const venceu = setsPro > setsContra
  return {
    equipeId,
    jogos: 1,
    vitorias: venceu ? 1 : 0,
    derrotas: venceu ? 0 : 1,
    setsPro,
    setsContra,
    pontosPro,
    pontosContra,
    pontos: pontosDaMargem(setsPro, setsContra, faixas),
  }
}

function somarLado(tabela: Map<number, Acumulado>, equipeId: number, delta: Omit<ReturnType<typeof lado>, 'equipeId'>) {
  const linha = tabela.get(equipeId)
  if (!linha) return
  linha.jogos += delta.jogos
  linha.vitorias += delta.vitorias
  linha.derrotas += delta.derrotas
  linha.setsPro += delta.setsPro
  linha.setsContra += delta.setsContra
  linha.pontosPro += delta.pontosPro
  linha.pontosContra += delta.pontosContra
  linha.pontos += delta.pontos
}

function comparar(esquerda: Acumulado, direita: Acumulado, criterios: string[]) {
  for (const criterio of criterios) {
    const diferenca = valorCriterio(direita, criterio) - valorCriterio(esquerda, criterio)
    if (diferenca !== 0) return criterio === 'DERROTAS' ? -diferenca : diferenca
  }
  return esquerda.equipeId - direita.equipeId
}

function valorCriterio(linha: Acumulado, criterio: string) {
  if (criterio === 'PONTOS') return linha.pontos
  if (criterio === 'VITORIAS') return linha.vitorias
  if (criterio === 'DERROTAS') return linha.derrotas
  if (criterio === 'SALDO_SETS') return linha.setsPro - linha.setsContra
  if (criterio === 'SALDO_PONTOS') return linha.pontosPro - linha.pontosContra
  if (criterio === 'SETS_PRO') return linha.setsPro
  return linha.pontosPro
}

function timesDaCategoria(
  partida: PartidaClassificacao,
  categoriaId: string | null,
  timePorId: Map<number, { categoriaCampeonatoId: string | null }>,
) {
  const a = timePorId.get(Number(partida.equipeAId))
  const b = timePorId.get(Number(partida.equipeBId))
  if (!a || !b) return false
  return (a.categoriaCampeonatoId ?? null) === categoriaId && (b.categoriaCampeonatoId ?? null) === categoriaId
}

function categoriaEfetiva(
  partida: PartidaClassificacao,
  timePorId: Map<number, { categoriaCampeonatoId: string | null }>,
) {
  if (partida.categoriaCampeonatoId) return partida.categoriaCampeonatoId
  const a = timePorId.get(Number(partida.equipeAId))
  const b = timePorId.get(Number(partida.equipeBId))
  if (a?.categoriaCampeonatoId && a.categoriaCampeonatoId === b?.categoriaCampeonatoId) return a.categoriaCampeonatoId
  return null
}

function regraDaCategoria(regras: Record<string, RegrasCategoria | null | undefined> | undefined, categoriaId: string | null) {
  const especifica = categoriaId ? regras?.[categoriaId] : undefined
  const comum = regras?.['']
  const fonte = especifica ?? comum ?? {}
  return {
    faixas: { ...FAIXAS_PADRAO, ...(fonte.faixas ?? {}) },
    criterios: normalizarCriterios(fonte.criterios),
    set: { ...REGRA_SET_PADRAO, ...(fonte.set ?? {}) },
  }
}

function linhaZerada(time: { equipeId: number; categoriaCampeonatoId: string | null; categoria: string }): Acumulado {
  return {
    equipeId: time.equipeId,
    categoriaCampeonatoId: time.categoriaCampeonatoId,
    categoria: time.categoria,
    pontos: 0,
    jogos: 0,
    vitorias: 0,
    derrotas: 0,
    setsPro: 0,
    setsContra: 0,
    pontosPro: 0,
    pontosContra: 0,
  }
}

function criteriosJson(texto: string) {
  try {
    const valor = JSON.parse(texto)
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}
