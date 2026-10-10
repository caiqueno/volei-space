import { setEstaEncerrado, type RegraSet } from '@/lib/set-encerrado'
import { DEFAULT_CRITERIOS_CLASSIFICACAO } from '@/lib/championship-setup-defaults'
import { regrasParaFase } from '@/lib/category-match-rules'
import type { SetsPorFase } from '@/lib/sets-por-fase'
import { placarDoWo, woConfigurado, type WoConfig } from '@/lib/wo'

/**
 * Cálculo puro da tabela. A função SQL `recalcular_classificacao_liga` que
 * prevalece depois de `supabase-recalcular-classificacao-liga-atomico.sql`
 * ainda usa 4/3/1/0, mistura o mata-mata e ignora o set já encerrado.
 * O servidor grava o resultado desta função. A RPC antiga não é chamada.
 * A persistência usa a trava da súmula em gravar_classificacao_calculada.
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
  'CONFRONTO_DIRETO',
  'VITORIAS',
  'DERROTAS',
  'SALDO_SETS',
  'SALDO_PONTOS',
  'SETS_PRO',
  'PONTOS_PRO',
  'SET_AVERAGE',
  'POINT_AVERAGE',
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
  set?: (Partial<RegraSet> & Partial<SetsPorFase> & { setsFormato?: string; terceiroSetObrigatorio?: boolean }) | null
  wo?: WoConfig | null
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
  punicoes: number
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
  punicoesPorEquipe?: Record<number, number> | null
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
    aplicarPartidaEncerrada(tabela, partida, regra.faixas, regra.wo)
  }

  for (const partida of input.partidas) {
    if (!faseContaNaClassificacao(partida.fase)) continue
    if (String(partida.status ?? '').trim().toUpperCase() !== 'EM_ANDAMENTO') continue
    const categoriaId = categoriaEfetiva(partida, timePorId)
    if (!timesDaCategoria(partida, categoriaId, timePorId)) continue
    const regra = regraDaCategoria(input.regras, categoriaId)
    aplicarSetsAoVivo(tabela, partida, regraDeSet(regra.set, partida.fase))
  }

  for (const [equipeId, peso] of Object.entries(input.punicoesPorEquipe ?? {})) {
    const valor = Number(peso)
    if (!Number.isFinite(valor) || valor === 0) continue
    somarLado(tabela, Number(equipeId), {
      jogos: 0, vitorias: 0, derrotas: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: 0, punicoes: valor,
    })
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
    ranque.push(...ordenarClassificacao(linhas, criterios, input.partidas))
  }
  return ranque.sort((esquerda, direita) => (
    String(esquerda.categoriaCampeonatoId ?? '').localeCompare(String(direita.categoriaCampeonatoId ?? ''))
    || esquerda.posicao - direita.posicao
    || esquerda.equipeId - direita.equipeId
  ))
}

function aplicarPartidaEncerrada(tabela: Map<number, Acumulado>, partida: PartidaClassificacao, faixas: FaixasPontos, wo?: WoConfig | null) {
  const status = String(partida.status ?? '').trim().toUpperCase()
  const woAplicado = status === 'WO' && partida.vencedorId != null ? placarDoWo(wo, Number(partida.vencedorId) === Number(partida.equipeAId)) : null
  const placar = woAplicado && woConfigurado(wo)
    ? { setsA: woAplicado.setsA, setsB: woAplicado.setsB, pontosA: woAplicado.pontosA, pontosB: woAplicado.pontosB }
    : placarOficial(partida)
  if (placar.setsA === placar.setsB) {
    if (status !== 'WO' || partida.vencedorId == null) return
    const vencedorId = Number(partida.vencedorId)
    const perdedorId = vencedorId === Number(partida.equipeAId) ? Number(partida.equipeBId) : Number(partida.equipeAId)
    const punicao = woAplicado?.punicaoNoPerdedor ?? 0
    somarLado(tabela, vencedorId, { jogos: 1, vitorias: 1, derrotas: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: faixas.pontosVencedorMargem2, punicoes: 0 })
    somarLado(tabela, perdedorId, { jogos: 1, vitorias: 0, derrotas: 1, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: faixas.pontosPerdedorMargem2 - punicao, punicoes: punicao })
    return
  }

  const lados = [
    lado(Number(partida.equipeAId), placar.setsA, placar.setsB, placar.pontosA, placar.pontosB, faixas),
    lado(Number(partida.equipeBId), placar.setsB, placar.setsA, placar.pontosB, placar.pontosA, faixas),
  ]
  for (const item of lados) somarLado(tabela, item.equipeId, item)
  if (woAplicado && woAplicado.punicaoNoPerdedor > 0 && partida.vencedorId != null) {
    const perdedorId = Number(partida.vencedorId) === Number(partida.equipeAId) ? Number(partida.equipeBId) : Number(partida.equipeAId)
    somarLado(tabela, perdedorId, { jogos: 0, vitorias: 0, derrotas: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0, pontos: -woAplicado.punicaoNoPerdedor, punicoes: woAplicado.punicaoNoPerdedor })
  }
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
      punicoes: 0,
    })
    somarLado(tabela, Number(partida.equipeBId), {
      jogos: 0, vitorias: 0, derrotas: 0,
      setsPro: aVenceu ? 0 : 1,
      setsContra: aVenceu ? 1 : 0,
      pontosPro: Number(set.pontosB),
      pontosContra: Number(set.pontosA),
      pontos: 0,
      punicoes: 0,
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
    punicoes: 0,
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
  linha.punicoes += delta.punicoes
}

function comparar(esquerda: Acumulado, direita: Acumulado, criterios: string[]) {
  return diferencaCriterios(esquerda, direita, criterios) || esquerda.equipeId - direita.equipeId
}

function diferencaCriterios(esquerda: Acumulado, direita: Acumulado, criterios: string[]) {
  for (const criterio of criterios) {
    if (criterio === 'CONFRONTO_DIRETO') continue
    const diferenca = valorCriterio(direita, criterio) - valorCriterio(esquerda, criterio)
    if (diferenca !== 0) return criterio === 'DERROTAS' ? -diferenca : diferenca
  }
  return 0
}

export function criteriosComConfrontoDireto(criterios?: string[] | string | null) {
  const base = normalizarCriterios(criterios).filter((criterio) => criterio !== 'CONFRONTO_DIRETO')
  const indice = base.indexOf('PONTOS')
  const posicao = indice === -1 ? 0 : indice + 1
  return [...base.slice(0, posicao), 'CONFRONTO_DIRETO', ...base.slice(posicao)]
}

export function ordenarClassificacao<T extends Acumulado>(
  linhas: T[],
  criterios: string[],
  partidas: PartidaClassificacao[] = [],
): Array<T & { posicao: number }> {
  const indice = criterios.indexOf('CONFRONTO_DIRETO')
  const antes = indice === -1 ? criterios : criterios.slice(0, indice)
  const depois = indice === -1 ? [] : criterios.slice(indice + 1)
  const ordenadas = [...linhas].sort((esquerda, direita) => (
    diferencaCriterios(esquerda, direita, antes) || esquerda.equipeId - direita.equipeId
  ))
  const blocos: T[][] = []
  for (const linha of ordenadas) {
    const ultimo = blocos[blocos.length - 1]
    if (!ultimo || indice === -1 || diferencaCriterios(ultimo[0], linha, antes) !== 0) blocos.push([linha])
    else ultimo.push(linha)
  }
  const resultado = indice === -1
    ? ordenadas
    : blocos.flatMap((bloco) => (bloco.length < 2 ? bloco : ordenarEmpate(bloco, partidas, depois)))
  return resultado.map((linha, posicao) => ({ ...linha, posicao: posicao + 1 }))
}

function ordenarEmpate<T extends Acumulado>(bloco: T[], partidas: PartidaClassificacao[], depois: string[]) {
  const ids = new Set(bloco.map((linha) => linha.equipeId))
  const mini = new Map(bloco.map((linha) => [linha.equipeId, { pontos: 0, vitorias: 0, setsPro: 0, setsContra: 0, pontosPro: 0, pontosContra: 0 }]))
  for (const partida of partidas) {
    if (!faseContaNaClassificacao(partida.fase) || !partidaEncerrada(partida)) continue
    const equipeAId = Number(partida.equipeAId)
    const equipeBId = Number(partida.equipeBId)
    if (!ids.has(equipeAId) || !ids.has(equipeBId)) continue
    const placar = placarOficial(partida)
    const status = String(partida.status ?? '').trim().toUpperCase()
    if (placar.setsA === placar.setsB) {
      if (status !== 'WO' || partida.vencedorId == null) continue
      const vencedorId = Number(partida.vencedorId)
      const perdedorId = vencedorId === equipeAId ? equipeBId : equipeAId
      somarMini(mini, vencedorId, FAIXAS_PADRAO.pontosVencedorMargem2, 1, 0, 0, 0, 0)
      somarMini(mini, perdedorId, FAIXAS_PADRAO.pontosPerdedorMargem2, 0, 0, 0, 0, 0)
      continue
    }
    somarMini(mini, equipeAId, pontosDaMargem(placar.setsA, placar.setsB, FAIXAS_PADRAO), placar.setsA > placar.setsB ? 1 : 0, placar.setsA, placar.setsB, placar.pontosA, placar.pontosB)
    somarMini(mini, equipeBId, pontosDaMargem(placar.setsB, placar.setsA, FAIXAS_PADRAO), placar.setsB > placar.setsA ? 1 : 0, placar.setsB, placar.setsA, placar.pontosB, placar.pontosA)
  }
  return [...bloco].sort((esquerda, direita) => {
    const daEsquerda = mini.get(esquerda.equipeId)
    const daDireita = mini.get(direita.equipeId)
    const confronto = (daDireita?.pontos ?? 0) - (daEsquerda?.pontos ?? 0)
      || (daDireita?.vitorias ?? 0) - (daEsquerda?.vitorias ?? 0)
      || ((daDireita?.setsPro ?? 0) - (daDireita?.setsContra ?? 0)) - ((daEsquerda?.setsPro ?? 0) - (daEsquerda?.setsContra ?? 0))
      || ((daDireita?.pontosPro ?? 0) - (daDireita?.pontosContra ?? 0)) - ((daEsquerda?.pontosPro ?? 0) - (daEsquerda?.pontosContra ?? 0))
    if (confronto !== 0) return confronto
    return diferencaCriterios(esquerda, direita, depois) || esquerda.equipeId - direita.equipeId
  })
}

function somarMini(
  mini: Map<number, { pontos: number; vitorias: number; setsPro: number; setsContra: number; pontosPro: number; pontosContra: number }>,
  equipeId: number,
  pontos: number,
  vitorias: number,
  setsPro: number,
  setsContra: number,
  pontosPro: number,
  pontosContra: number,
) {
  const linha = mini.get(equipeId)
  if (!linha) return
  linha.pontos += pontos
  linha.vitorias += vitorias
  linha.setsPro += setsPro
  linha.setsContra += setsContra
  linha.pontosPro += pontosPro
  linha.pontosContra += pontosContra
}

export function classificarPorGrupos<T extends Acumulado>(input: {
  linhas: T[]
  grupos: Array<{ id: string | number; nome: string; equipeIds: number[]; automaticLimit?: number }>
  partidas: PartidaClassificacao[]
  criterios?: string[] | string | null
}) {
  const criterios = criteriosComConfrontoDireto(input.criterios)
  const porId = new Map(input.linhas.map((linha) => [linha.equipeId, linha]))
  return input.grupos.map((grupo) => {
    const doGrupo = grupo.equipeIds
      .map((equipeId) => porId.get(Number(equipeId)))
      .filter((linha): linha is T => Boolean(linha))
    return {
      id: String(grupo.id),
      nome: grupo.nome,
      automaticLimit: grupo.automaticLimit ?? 2,
      linhas: ordenarClassificacao(doGrupo, criterios, input.partidas),
    }
  })
}

function quociente(pro: number, contra: number) {
  if (contra === 0) return pro > 0 ? 1_000_000_000 : 0
  return pro / contra
}

function valorCriterio(linha: Acumulado, criterio: string) {
  if (criterio === 'PONTOS') return linha.pontos
  if (criterio === 'VITORIAS') return linha.vitorias
  if (criterio === 'DERROTAS') return linha.derrotas
  if (criterio === 'SALDO_SETS') return linha.setsPro - linha.setsContra
  if (criterio === 'SALDO_PONTOS') return linha.pontosPro - linha.pontosContra
  if (criterio === 'SETS_PRO') return linha.setsPro
  if (criterio === 'SET_AVERAGE') return quociente(linha.setsPro, linha.setsContra)
  if (criterio === 'POINT_AVERAGE') return quociente(linha.pontosPro, linha.pontosContra)
  return linha.pontosPro
}

/** A checagem antiga da categoria não conhece os quocientes. Sem ela, o restante do salvamento segue. */
export function criteriosPersistiveis(valor: unknown) {
  if (typeof valor !== 'string' || !/SET_AVERAGE|POINT_AVERAGE/.test(valor)) return valor
  try {
    const lista = JSON.parse(valor)
    if (!Array.isArray(lista)) return valor
    return JSON.stringify(lista.filter((item) => item !== 'SET_AVERAGE' && item !== 'POINT_AVERAGE'))
  } catch {
    return valor
  }
}

export function erroRecusaQuociente(erro: { code?: string; message?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /23514|check constraint/i.test(texto)
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

function regraDeSet(set: RegrasCategoria['set'], fase?: string | null): RegraSet {
  const ajustada = regrasParaFase(set, fase)
  return {
    setsPorPartida: ajustada.setsPorPartida,
    pontosPorSet: ajustada.pontosPorSet,
    tieBreakUltimoSet: ajustada.tieBreakUltimoSet === true,
    pontosUltimoSet: ajustada.pontosUltimoSet,
    diferencaMinimaSet: set?.diferencaMinimaSet,
  }
}

function regraDaCategoria(regras: Record<string, RegrasCategoria | null | undefined> | undefined, categoriaId: string | null) {
  const especifica = categoriaId ? regras?.[categoriaId] : undefined
  const comum = regras?.['']
  const fonte = especifica ?? comum ?? {}
  return {
    faixas: { ...FAIXAS_PADRAO, ...(fonte.faixas ?? {}) },
    criterios: normalizarCriterios(fonte.criterios),
    set: { ...REGRA_SET_PADRAO, ...(fonte.set ?? {}) },
    wo: fonte.wo ?? null,
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
    punicoes: 0,
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
