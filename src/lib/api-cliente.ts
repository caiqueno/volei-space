import { CACHE_CONSULTA_MS, LIMIAR_INDICADOR_MS, TIMEOUT_CONSULTA_MS, caminhoConsulta } from '@/lib/desempenho'

export class ConsultaCancelada extends Error {
  constructor() {
    super('Consulta cancelada')
    this.name = 'ConsultaCancelada'
  }
}

type EntradaCache = { expira: number; corpo: unknown }
type EmVoo = {
  promise: Promise<unknown>
  controle: AbortController
  esperando: number
  expirou: boolean
}

type Registro = { consulta: string; origem: 'cache' | 'dedup' | 'rede' | 'erro' | 'timeout'; ms: number }

const cache = new Map<string, EntradaCache>()
const emVoo = new Map<string, EmVoo>()
const registros: Registro[] = []
const ouvintes = new Set<() => void>()
const pendentes = new Map<number, { lento: boolean }>()
let sequencia = 0
let escopoVisto = ''

function notificar() {
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function assinarCarregamento(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function haCarregamentoLento() {
  let lento = false
  pendentes.forEach((item) => {
    if (item.lento) lento = true
  })
  return lento
}

export function diagnosticoConsultas() {
  return registros.slice()
}

function registrar(origem: Registro['origem'], url: string, ms: number) {
  registros.push({ consulta: caminhoConsulta(url), origem, ms })
  if (registros.length > 40) registros.shift()
  if (process.env.NODE_ENV !== 'production') {
    console.info('[consulta]', caminhoConsulta(url), origem, `${ms}ms`)
  }
}

function escopoAtual() {
  if (typeof window === 'undefined') return 'servidor'
  let escopo = 'anon'
  try {
    const sessao = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null') as { tipo?: string; candidaturaId?: string | null } | null
    escopo = `${sessao?.tipo || 'anon'}:${sessao?.candidaturaId || 'sem-conta'}`
  } catch {
    escopo = 'anon'
  }
  if (escopoVisto && escopoVisto !== escopo) {
    cache.clear()
    emVoo.clear()
  }
  escopoVisto = escopo
  return escopo
}

export function invalidarConsultas(prefixo: string) {
  const caminho = caminhoConsulta(prefixo)
  Array.from(cache.keys()).forEach((chave) => {
    if (chave.includes(caminho)) cache.delete(chave)
  })
}

function marcarPendente() {
  const id = ++sequencia
  const item = { lento: false }
  pendentes.set(id, item)
  const aviso = window.setTimeout(() => {
    if (!pendentes.has(id)) return
    item.lento = true
    notificar()
  }, LIMIAR_INDICADOR_MS)
  return () => {
    window.clearTimeout(aviso)
    pendentes.delete(id)
    notificar()
  }
}

function observar<T>(promise: Promise<T>, signal: AbortSignal | undefined, aoCancelar: () => void) {
  return new Promise<T>((resolve, reject) => {
    let fechado = false
    const concluir = (acao: () => void) => {
      if (fechado) return
      fechado = true
      signal?.removeEventListener('abort', cancelar)
      acao()
    }
    const cancelar = () => {
      aoCancelar()
      concluir(() => reject(new ConsultaCancelada()))
    }
    if (signal?.aborted) {
      cancelar()
      return
    }
    signal?.addEventListener('abort', cancelar)
    promise.then(
      (valor) => concluir(() => resolve(valor)),
      (erro) => concluir(() => reject(erro)),
    )
  })
}

export async function lerJson<T>(response: Response): Promise<T> {
  let texto = ''
  try {
    texto = await response.text()
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    throw new Error('A resposta do servidor veio incompleta. Tente novamente.')
  }
  if (!texto.trim()) {
    if (!response.ok) return {} as T
    throw new Error('A resposta do servidor veio incompleta. Tente novamente.')
  }
  try {
    return JSON.parse(texto) as T
  } catch {
    throw new Error('A resposta do servidor veio incompleta. Tente novamente.')
  }
}

export async function consultar<T>(url: string, opcoes?: { signal?: AbortSignal; forcar?: boolean }): Promise<T> {
  const escopo = escopoAtual()
  const chave = `${escopo} ${url}`
  const guardado = cache.get(chave)
  if (!opcoes?.forcar && guardado && guardado.expira > Date.now()) {
    registrar('cache', url, 0)
    return guardado.corpo as T
  }

  let atual = emVoo.get(chave)
  if (!atual || opcoes?.forcar) {
    const controle = new AbortController()
    const inicio = Date.now()
    const encerrarMarca = typeof window === 'undefined' ? () => {} : marcarPendente()
    const timer = typeof window === 'undefined'
      ? null
      : window.setTimeout(() => {
        const voo = emVoo.get(chave)
        if (!voo) return
        voo.expirou = true
        voo.controle.abort()
      }, TIMEOUT_CONSULTA_MS)

    const promise = fetch(url, { cache: 'no-store', signal: controle.signal })
      .then(async (response) => {
        const payload = await lerJson<{ error?: string }>(response)
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os dados.')
        cache.set(chave, { expira: Date.now() + CACHE_CONSULTA_MS, corpo: payload })
        registrar('rede', url, Date.now() - inicio)
        return payload
      })
      .catch((erro: unknown) => {
        const voo = emVoo.get(chave)
        if (voo?.expirou) {
          registrar('timeout', url, Date.now() - inicio)
          throw new Error('A consulta demorou demais. Tente novamente.')
        }
        if (erro instanceof DOMException && erro.name === 'AbortError') throw new ConsultaCancelada()
        registrar('erro', url, Date.now() - inicio)
        throw erro
      })
      .finally(() => {
        if (timer != null) window.clearTimeout(timer)
        encerrarMarca()
        if (emVoo.get(chave) === atual) emVoo.delete(chave)
      })

    atual = { promise, controle, esperando: 0, expirou: false }
    emVoo.set(chave, atual)
  } else {
    registrar('dedup', url, 0)
  }

  const voo = atual
  voo.esperando += 1
  return observar(voo.promise as Promise<T>, opcoes?.signal, () => {
    voo.esperando -= 1
    if (voo.esperando <= 0) {
      if (emVoo.get(chave) === voo) emVoo.delete(chave)
      voo.controle.abort()
    }
  })
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as Window & { __voleiConsultas?: unknown }).__voleiConsultas = {
    diagnosticoConsultas,
    invalidarConsultas,
  }
}
