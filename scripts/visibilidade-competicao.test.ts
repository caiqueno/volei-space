import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

async function main() {
  const { competicaoPrivada, semPrivadas, semIdsPrivados, idsCompeticoesPrivadas, limparCacheCompeticoesPrivadas } = await import('../src/lib/visibilidade-competicao')

  // Funções puras.
  assert.equal(competicaoPrivada({ visibilidade: 'PRIVADA' }), true)
  assert.equal(competicaoPrivada({ visibilidade: ' privada ' }), true)
  for (const v of ['PUBLICA', null, undefined, '', 'X']) assert.equal(competicaoPrivada({ visibilidade: v }), false)
  assert.equal(competicaoPrivada(null), false)
  assert.deepEqual(semPrivadas([{ id: 1, visibilidade: 'PRIVADA' }, { id: 2, visibilidade: 'PUBLICA' }, { id: 3 }]).map((l) => l.id), [2, 3])
  assert.deepEqual(semIdsPrivados([{ id: 1 }, { id: 2 }], new Set([2])).map((l) => l.id), [1])

  const tabelas: Tabelas = {
    Liga: [
      { id: 1, slug: 'aberta', nome: 'Aberta', simulacao: false, status: 'ATIVA', visibilidade: 'PUBLICA', criadoEm: '2026-01-01' },
      { id: 2, slug: 'secreta', nome: 'Secreta', simulacao: false, status: 'ATIVA', visibilidade: 'PRIVADA', criadoEm: '2026-01-02' },
    ],
    Partida: [],
  }
  const rede = instalarPostgrestFalso(tabelas)
  try {
    limparCacheCompeticoesPrivadas()
    assert.deepEqual([...(await idsCompeticoesPrivadas({ semCache: true }))], [2])

    // GET /api/ligas (visitante): a privada não aparece.
    const { GET: listarLigas } = await import('../src/app/api/ligas/route')
    const resposta = await listarLigas(new NextRequest('http://127.0.0.1:3001/api/ligas'))
    assert.equal(resposta.status, 200)
    const json = (await resposta.json()) as { data: Array<{ id: number }> }
    assert.deepEqual(json.data.map((l) => l.id), [1])

    // Portal: campeonatos ativos.
    const { GET: ativos } = await import('../src/app/api/portal/ativos/route')
    const portal = (await (await ativos()).json()) as { data: Array<{ id: number }> }
    assert.deepEqual(portal.data.map((l) => l.id), [1])

    // Vitrine pública.
    const { listarCampeonatosPublicos } = await import('../src/lib/campeonatos-publicos')
    const vitrine = await listarCampeonatosPublicos()
    assert.deepEqual(vitrine.campeonatos.map((l) => l.id), [1])

  } finally {
    rede.restaurar()
  }

  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('visibilidade=eq.PRIVADA')) {
      return new Response(JSON.stringify({ code: '42703', message: 'column Liga.visibilidade does not exist' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`fetch fora do teste: ${url}`)
  }) as typeof fetch
  try {
    limparCacheCompeticoesPrivadas()
    assert.equal((await idsCompeticoesPrivadas({ semCache: true })).size, 0, 'sem a coluna, tudo é público')
  } finally {
    globalThis.fetch = original
  }

  console.log('visibilidade-competicao: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
