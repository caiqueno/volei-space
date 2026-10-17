import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { CACHE_CONTROL_PRIVADO, CACHE_CONTROL_PUBLICO } from '../src/lib/cache-publico'

process.env.JWT_SECRET ||= 'teste-local-jwt-secret-32-chars-min'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://cache-publico-teste.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-teste-cache-publico'
process.env.NEXT_PUBLIC_SUPABASE_ALVO = 'desenvolvimento'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-teste-cache-publico'
delete process.env.VERCEL_ENV
delete process.env.NEXT_PUBLIC_VERCEL_ENV

const HOST = 'https://cache-publico-teste.supabase.co/'
const CATEGORIA_VALIDA = '11111111-1111-4111-8111-111111111111'

type Chamada = { url: string; method: string }

function urlDe(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function instalarFetch(modo: 'ok' | 'erro') {
  const chamadas: Chamada[] = []
  const original = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlDe(input)
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase()
    // Consulta auxiliar de competições privadas (nenhuma privada aqui); não conta como leitura da lista.
    if (modo === 'ok' && url.includes('visibilidade=eq.PRIVADA')) {
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    chamadas.push({ url, method })
    if (!url.startsWith(HOST)) throw new Error(`fetch fora do teste: ${method} ${url}`)
    if (modo === 'erro') {
      return new Response(JSON.stringify({ message: 'falha de teste', code: 'XX000' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
    const corpo = url.includes('/CategoriaCampeonato')
      ? [{ id: CATEGORIA_VALIDA, nome: 'Adulto', codigo: 'adulto', ordem: 1 }]
      : [{ id: 7, nome: 'Copa', simulacao: false, status: 'ATIVA' }]
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return {
    chamadas,
    restaurar() {
      globalThis.fetch = original
    },
  }
}

function assertCachePublico(resposta: Response, onde: string) {
  assert.equal(resposta.status, 200, onde)
  assert.equal(resposta.headers.get('cache-control'), CACHE_CONTROL_PUBLICO, onde)
  assert.equal(resposta.headers.get('set-cookie'), null, onde)
  assert.equal((resposta.headers.get('vary') ?? '').toLowerCase().includes('cookie'), false, onde)
}

function assertSemCache(resposta: Response, status: number, onde: string) {
  assert.equal(resposta.status, status, onde)
  const controle = resposta.headers.get('cache-control') ?? ''
  assert.equal(controle, CACHE_CONTROL_PRIVADO, onde)
  assert.equal(controle.includes('s-maxage'), false, onde)
}

async function main() {
  const sMax = /s-maxage=(\d+)/.exec(CACHE_CONTROL_PUBLICO)
  assert.ok(sMax, 's-maxage')
  const segundos = Number(sMax[1])
  assert.ok(segundos >= 30 && segundos <= 60, `s-maxage conservador, recebido ${segundos}`)
  assert.match(CACHE_CONTROL_PUBLICO, /stale-while-revalidate=\d+/)
  assert.match(CACHE_CONTROL_PUBLICO, /max-age=0/)
  assert.doesNotMatch(CACHE_CONTROL_PUBLICO, /must-revalidate/)
  assert.match(CACHE_CONTROL_PRIVADO, /private/)
  assert.match(CACHE_CONTROL_PRIVADO, /no-store/)

  const { GET: listarLigas } = await import('../src/app/api/ligas/route')
  const { GET: listarCategorias } = await import('../src/app/api/categorias/route')

  const rede = instalarFetch('ok')
  try {
    const publica = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas', {
      headers: { cookie: 'luva_token=sessao-alheia', authorization: 'Bearer token-alheio' },
    }))
    assertCachePublico(publica, 'GET /api/ligas')
    const jsonPublico = await publica.json() as { data?: Array<{ nome?: string }> }
    assert.equal(jsonPublico.data?.[0]?.nome, 'Copa')
    assert.equal(rede.chamadas.length, 1)
    assert.match(rede.chamadas[0].url, /\/Liga\?/)
    assert.match(rede.chamadas[0].url, /simulacao=eq\.false/)
    assert.doesNotMatch(rede.chamadas[0].url, /organizadorId/)
    assert.doesNotMatch(rede.chamadas[0].url, /seedKey|pagamentoConfirmadoEm|simulacaoRelogio/)

    rede.chamadas.length = 0
    const filtrada = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas?status=ATIVA&q=copa'))
    assertCachePublico(filtrada, 'GET /api/ligas?status&q')
    assert.equal(rede.chamadas.length, 1)
    assert.match(rede.chamadas[0].url, /status=eq\.ATIVA/)
    assert.match(rede.chamadas[0].url, /copa/)
    assert.match(rede.chamadas[0].url, /simulacao=eq\.false/)

    rede.chamadas.length = 0
    const outraBusca = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas?q=outra'))
    assertCachePublico(outraBusca, 'GET /api/ligas?q=outra')
    assert.match(rede.chamadas[0].url, /outra/)
    assert.doesNotMatch(rede.chamadas[0].url, /copa/)

    rede.chamadas.length = 0
    const doOrganizador = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas?organizadorId=org-1&status=ATIVA', {
      headers: { cookie: 'luva_token=sessao-alheia' },
    }))
    assertSemCache(doOrganizador, 401, 'GET /api/ligas?organizadorId')
    assert.equal(rede.chamadas.length, 0, 'a variante do organizador não consulta o banco sem sessão')

    rede.chamadas.length = 0
    const categorias = await listarCategorias(new NextRequest('http://127.0.0.1:3001/api/categorias?ligaId=12', {
      headers: { cookie: 'luva_token=sessao-alheia', authorization: 'Bearer token-alheio' },
    }))
    assertCachePublico(categorias, 'GET /api/categorias')
    const jsonCategorias = await categorias.json() as { data?: Array<{ nome?: string }> }
    assert.equal(jsonCategorias.data?.[0]?.nome, 'Adulto')
    assert.equal(rede.chamadas.length, 1)
    assert.match(rede.chamadas[0].url, /\/CategoriaCampeonato\?/)
    assert.match(rede.chamadas[0].url, /ligaId=eq\.12/)
    assert.match(rede.chamadas[0].url, /select=id%2Cnome%2Ccodigo%2Cordem|select=id,nome,codigo,ordem/)

    rede.chamadas.length = 0
    const comCategoria = await listarCategorias(new NextRequest(`http://127.0.0.1:3001/api/categorias?ligaId=12&categoria=${CATEGORIA_VALIDA}`))
    assertCachePublico(comCategoria, 'GET /api/categorias com categoria válida')
    assert.match(rede.chamadas[0].url, /ligaId=eq\.12/)
    assert.doesNotMatch(rede.chamadas[0].url, new RegExp(CATEGORIA_VALIDA))

    rede.chamadas.length = 0
    const ligaInvalida = await listarCategorias(new NextRequest('http://127.0.0.1:3001/api/categorias?ligaId=0'))
    assertSemCache(ligaInvalida, 422, 'ligaId inválido')
    assert.equal(rede.chamadas.length, 0)

    const categoriaInvalida = await listarCategorias(new NextRequest('http://127.0.0.1:3001/api/categorias?ligaId=12&categoria=nao-uuid'))
    assertSemCache(categoriaInvalida, 422, 'categoria inválida')
    assert.equal(rede.chamadas.length, 0)
  } finally {
    rede.restaurar()
  }

  const falha = instalarFetch('erro')
  try {
    const erroLigas = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas'))
    assertSemCache(erroLigas, 500, 'erro de ligas')
    const erroCategorias = await listarCategorias(new NextRequest('http://127.0.0.1:3001/api/categorias?ligaId=12'))
    assertSemCache(erroCategorias, 503, 'erro de categorias')
  } finally {
    falha.restaurar()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
