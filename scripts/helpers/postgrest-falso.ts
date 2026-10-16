// PostgREST falso para testes de rota: troca o fetch global e responde às consultas
// do supabase-js a partir de tabelas em memória. Honra select (colunas do topo),
// eq., in., is. e neq.; ignora embeds, ordenação e limites.
// Chame configurarAmbienteSupabase() ANTES de importar qualquer módulo de src/.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const HOST_FALSO = 'https://postgrest-falso.supabase.co/'

export function configurarAmbienteSupabase() {
  process.env.JWT_SECRET ||= 'teste-local-jwt-secret-32-chars-min'
  process.env.NEXT_PUBLIC_SUPABASE_URL = HOST_FALSO.replace(/\/$/, '')
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-teste'
  process.env.NEXT_PUBLIC_SUPABASE_ALVO = 'desenvolvimento'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-teste'
  delete process.env.VERCEL_ENV
  delete process.env.NEXT_PUBLIC_VERCEL_ENV
}

export type Tabelas = Record<string, Array<Record<string, any>>>
export type ChamadaFalsa = { tabela: string; select: string; search: string; metodo: string; corpo: string | null }

function colunasDoTopo(select: string) {
  const colunas: string[] = []
  let profundidade = 0
  let atual = ''
  for (const caractere of select) {
    if (caractere === '(') profundidade += 1
    if (caractere === ')') profundidade -= 1
    if (caractere === ',' && profundidade === 0) {
      colunas.push(atual.trim())
      atual = ''
    } else if (profundidade === 0) atual += caractere
  }
  if (atual.trim()) colunas.push(atual.trim())
  return colunas
}

function casa(linha: Record<string, any>, coluna: string, filtro: string) {
  const [operador, ...resto] = filtro.split('.')
  const valor = resto.join('.')
  const atual = linha[coluna]
  if (operador === 'eq') return String(atual) === valor
  if (operador === 'neq') return String(atual) !== valor
  if (operador === 'is') return valor === 'null' ? atual == null : String(atual) === valor
  if (operador === 'in') {
    const lista = valor.replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''))
    return lista.includes(String(atual))
  }
  return true
}

export type OpcoesPostgrestFalso = {
  /** Responde chamadas /storage/v1/...; devolver null cai no erro de fetch fora do teste. */
  storage?: (caminho: string, init?: RequestInit) => Response | null
}

export function instalarPostgrestFalso(tabelas: Tabelas, opcoes: OpcoesPostgrestFalso = {}) {
  const original = globalThis.fetch
  const chamadas: ChamadaFalsa[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith(HOST_FALSO)) throw new Error(`fetch fora do teste: ${url}`)
    const parsed = new URL(url)
    if (parsed.pathname.startsWith('/storage/v1/')) {
      const resposta = opcoes.storage?.(parsed.pathname + parsed.search, init)
      if (!resposta) throw new Error(`storage fora do teste: ${url}`)
      return resposta
    }
    const tabela = decodeURIComponent(parsed.pathname.replace('/rest/v1/', ''))
    const select = parsed.searchParams.get('select') ?? '*'
    chamadas.push({ tabela, select, search: parsed.search, metodo: (init?.method ?? 'GET').toUpperCase(), corpo: typeof init?.body === 'string' ? init.body : null })

    let linhas = [...(tabelas[tabela] ?? [])]
    for (const [chave, filtro] of Array.from(parsed.searchParams.entries())) {
      if (['select', 'order', 'limit', 'offset'].includes(chave)) continue
      linhas = linhas.filter((linha) => casa(linha, chave, filtro))
    }
    const colunas = colunasDoTopo(select)
    const projetadas = colunas.includes('*')
      ? linhas
      : linhas.map((linha) => Object.fromEntries(colunas.filter((c) => !c.includes(':') && !c.includes('(')).map((c) => [c, linha[c]])))
    return new Response(JSON.stringify(projetadas), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return {
    chamadas,
    restaurar() {
      globalThis.fetch = original
    },
  }
}

/** Todas as chaves de um JSON, em qualquer profundidade. */
export function chavesDe(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((item) => chavesDe(item, acc))
  else if (valor && typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) {
      acc.push(chave)
      chavesDe(item, acc)
    }
  }
  return acc
}
