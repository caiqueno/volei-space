import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

// A sessão vem do cookie (next/headers), que só existe dentro de uma requisição real do Next.
const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module

const CATEGORIA = '0b9f3b2e-6a5c-4c1e-9d2f-1a2b3c4d5e6f'
const BASE = 'http://127.0.0.1:3001'

function tabelasBase(): Tabelas {
  return {
    Liga: [
      { id: 1, slug: 'aberta', nome: 'Aberta', simulacao: false, status: 'ATIVA', visibilidade: 'PUBLICA', organizadorId: 'org-1', criadoEm: '2026-01-01' },
      { id: 2, slug: 'secreta', nome: 'Secreta', simulacao: false, status: 'ATIVA', visibilidade: 'PRIVADA', organizadorId: 'org-1', criadoEm: '2026-01-02' },
      { id: 3, slug: 'de-outro', nome: 'De outro', simulacao: false, status: 'ATIVA', visibilidade: 'PRIVADA', organizadorId: 'org-2', criadoEm: '2026-01-03' },
      { id: 4, slug: 'rascunho', nome: 'Rascunho', simulacao: false, status: 'RASCUNHO', visibilidade: 'PUBLICA', organizadorId: 'org-1', criadoEm: '2026-01-04' },
      { id: 5, slug: 'simulada', nome: 'Simulada', simulacao: true, status: 'ATIVA', visibilidade: 'PUBLICA', organizadorId: 'org-1', criadoEm: '2026-01-05' },
    ],
    Equipe: [
      { id: 10, nome: 'Equipe Aberta', ligaId: 1, statusEquipe: 'ATIVA' },
      { id: 20, nome: 'Equipe Secreta', ligaId: 2, statusEquipe: 'ATIVA' },
    ],
    InscricaoCampeonato: [
      { ligaId: 1, equipeId: 10, status: 'APROVADA' },
      { ligaId: 2, equipeId: 20, status: 'APROVADA' },
    ],
    Jogador: [],
    Partida: [],
    CategoriaCampeonato: [
      { id: CATEGORIA, ligaId: 2, nome: 'Adulto', codigo: 'ADU', ordem: 1, removidaEm: null, tokenInscricao: null },
      { id: 'cat-aberta', ligaId: 1, nome: 'Livre', codigo: 'LIV', ordem: 1, removidaEm: null, tokenInscricao: 'tok-livre' },
    ],
    CategoriaConfiguracao: [{ ligaId: 2, categoriaCampeonatoId: CATEGORIA }],
  }
}

// Envolve o PostgREST falso: respostas de objeto único (single) e simulação da coluna ausente.
function instalar(tabelas: Tabelas, estado: { semColuna: boolean }) {
  const falso = instalarPostgrestFalso(tabelas)
  const base = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const corpo = typeof init?.body === 'string' ? init.body : ''
    if (estado.semColuna && (url.includes('visibilidade') || corpo.includes('visibilidade'))) {
      return new Response(JSON.stringify({ code: '42703', message: 'column Liga.visibilidade does not exist' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    const resposta = await base(input, init)
    if (new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object')) {
      const lista = (await resposta.json()) as unknown[]
      if (!lista.length) return new Response(JSON.stringify({ code: 'PGRST116', message: '0 rows' }), { status: 406, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify(lista[0]), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return resposta
  }) as typeof fetch
  return { chamadas: falso.chamadas, restaurar: () => falso.restaurar() }
}

async function main() {
  const { signPublicToken, signToken } = await import('../src/lib/auth')
  const { limparCacheCompeticoesPrivadas, campeonatoPublicadoDaLiga, lerVisibilidadeDaLiga } = await import('../src/lib/visibilidade-competicao')
  const tokenOrg = (id: string) => signPublicToken({ userId: id, email: `${id}@t.local`, nome: id, tipo: 'organizador', status: 'ATIVA' })
  const tokenAdmin = () => signToken({ adminId: 1, email: 'admin@volei.space', nome: 'Admin' })
  const ids = (corpo: { data: Array<{ id: number }> }) => corpo.data.map((item) => item.id).sort()

  // ---------------------------------------------------------------- (b) listas públicas
  {
    const estado = { semColuna: false }
    const tabelas = tabelasBase()
    const rede = instalar(tabelas, estado)
    try {
      limparCacheCompeticoesPrivadas()
      sessao.token = null

      // Catálogo de /campeonatos: visitante nunca vê privada; status e busca continuam valendo.
      const { listarCatalogoCampeonatos } = await import('../src/lib/campeonatos-publicos')
      const catalogo = await listarCatalogoCampeonatos()
      assert.equal(catalogo.erro, false)
      assert.deepEqual(catalogo.campeonatos.map((l: { id: number }) => l.id).sort(), [1, 4])
      assert.equal(JSON.stringify(catalogo.campeonatos).includes('organizadorId'), false)

      // Agenda pública de vários campeonatos: a privada fica fora das consultas de Partida.
      const { buscarPartidasPublicas } = await import('../src/lib/agenda-publica')
      await buscarPartidasPublicas([1, 2], true)
      const consultas = rede.chamadas.filter((c) => c.tabela === 'Partida' && /ligaId=in\./.test(c.search))
      assert.ok(consultas.length > 0)
      for (const c of consultas) assert.match(decodeURIComponent(c.search), /ligaId=in\.\(1\)/, 'só a pública')
      const antes = rede.chamadas.length
      const soPrivada = await buscarPartidasPublicas([2], false)
      assert.deepEqual(soPrivada, { partidas: [], erro: false })
      assert.equal(rede.chamadas.slice(antes).some((c) => c.tabela === 'Partida'), false, 'privada sozinha não consulta partidas')

      // /api/equipes sem campeonato escolhido: visitante não vê a equipe da privada.
      const { GET: equipes } = await import('../src/app/api/equipes/route')
      const lista = (await (await equipes(new NextRequest(`${BASE}/api/equipes`))).json()) as { data: Array<{ id: number }> }
      assert.deepEqual(ids(lista), [10])
      // Com ligaId (pelo link) a privada continua acessível.
      const peloLink = (await (await equipes(new NextRequest(`${BASE}/api/equipes?ligaId=2`))).json()) as { data: Array<{ id: number }> }
      assert.deepEqual(ids(peloLink), [20])
      // Admin vê todas na lista.
      sessao.token = await tokenAdmin()
      const doAdmin = (await (await equipes(new NextRequest(`${BASE}/api/equipes`))).json()) as { data: Array<{ id: number }> }
      assert.deepEqual(ids(doAdmin), [10, 20])
      sessao.token = null

      // /api/partidas sem ligaId: a privada entra no filtro `not.in` para visitante; admin e dono não a escondem.
      const { GET: partidas } = await import('../src/app/api/partidas/route')
      const filtroPartida = async (token: string | null, url = `${BASE}/api/partidas`) => {
        sessao.token = token
        const inicio = rede.chamadas.length
        const resposta = await partidas(new NextRequest(url))
        assert.equal(resposta.status, 200)
        const consulta = rede.chamadas.slice(inicio).filter((c) => c.tabela === 'Partida').pop()
        sessao.token = null
        return decodeURIComponent(consulta?.search ?? '')
      }
      const doVisitante = await filtroPartida(null)
      assert.match(doVisitante, /ligaId=not\.in\.\([^)]*2/)
      assert.match(doVisitante, /ligaId=not\.in\.\([^)]*3/)
      assert.match(await filtroPartida(await tokenAdmin()), /ligaId=not\.in\.\(5\)/, 'admin: só a simulação sai')
      const doDono = await filtroPartida(await tokenOrg('org-1'))
      assert.match(doDono, /ligaId=not\.in\.\(5,3\)/, 'dono esconde só as privadas dos outros')
      assert.doesNotMatch(await filtroPartida(null, `${BASE}/api/partidas?ligaId=2`), /not\.in\.\([^)]*2/, 'com ligaId (link) não esconde')
    } finally {
      rede.restaurar()
    }

    // Coluna ausente: nada é escondido e nada quebra.
    const semColuna = { semColuna: true }
    const rede2 = instalar(tabelasBase(), semColuna)
    try {
      limparCacheCompeticoesPrivadas()
      const { listarCatalogoCampeonatos } = await import('../src/lib/campeonatos-publicos')
      const catalogo = await listarCatalogoCampeonatos()
      assert.deepEqual(catalogo.campeonatos.map((l: { id: number }) => l.id).sort(), [1, 2, 3, 4])
      const { GET: equipes } = await import('../src/app/api/equipes/route')
      const lista = (await (await equipes(new NextRequest(`${BASE}/api/equipes`))).json()) as { data: Array<{ id: number }> }
      assert.deepEqual(ids(lista), [10, 20])
      assert.equal(await lerVisibilidadeDaLiga(2), 'PUBLICA')
    } finally {
      rede2.restaurar()
      limparCacheCompeticoesPrivadas()
    }
  }

  // ---------------------------------------------------------------- (c) campeonatoPublicado
  {
    const estado = { semColuna: false }
    const rede = instalar(tabelasBase(), estado)
    try {
      assert.equal(await campeonatoPublicadoDaLiga(1), true)
      assert.equal(await campeonatoPublicadoDaLiga(2), false, 'privada')
      assert.equal(await campeonatoPublicadoDaLiga(4), false, 'rascunho')
      assert.equal(await campeonatoPublicadoDaLiga(5), false, 'simulação')
      assert.equal(await campeonatoPublicadoDaLiga(999), false, 'inexistente')

      // Painel do organizador: o campo vem em cada partida e no topo.
      const { GET: painel } = await import('../src/app/api/organizador/partidas/route')
      sessao.token = await tokenOrg('org-1')
      const lerPainel = async (ligaId: number) => {
        const resposta = await painel(new NextRequest(`${BASE}/api/organizador/partidas?ligaId=${ligaId}`))
        return { status: resposta.status, corpo: (await resposta.json()) as { data?: { campeonatoPublicado: boolean; partidas: Array<{ campeonatoPublicado: boolean }> } } }
      }
      const publica = await lerPainel(1)
      assert.equal(publica.status, 200)
      assert.equal(publica.corpo.data?.campeonatoPublicado, true)
      const privada = await lerPainel(2)
      assert.equal(privada.status, 200)
      assert.equal(privada.corpo.data?.campeonatoPublicado, false)
      // Liga de outro organizador: isolamento.
      assert.equal((await lerPainel(3)).status, 404)
      sessao.token = null
    } finally {
      rede.restaurar()
    }

    // Coluna ausente: publicada segue a regra de sempre (status e simulação).
    const rede2 = instalar(tabelasBase(), { semColuna: true })
    try {
      assert.equal(await campeonatoPublicadoDaLiga(1), true)
      assert.equal(await campeonatoPublicadoDaLiga(2), true, 'sem a coluna tudo é público')
      assert.equal(await campeonatoPublicadoDaLiga(4), false)
      assert.equal(await campeonatoPublicadoDaLiga(5), false)
    } finally {
      rede2.restaurar()
    }
  }

  // ---------------------------------------------------------------- (a) setup/inscricoes
  {
    const estado = { semColuna: false }
    const rede = instalar(tabelasBase(), estado)
    try {
      const { GET, PATCH } = await import('../src/app/api/organizador/ligas/[id]/setup/inscricoes/route')
      const contexto = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
      const patch = (id: number, corpo: unknown) => PATCH(new NextRequest(`${BASE}/api/organizador/ligas/${id}/setup/inscricoes?categoriaCampeonatoId=${CATEGORIA}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      }), contexto(id))
      const gravacoes = () => rede.chamadas.filter((c) => c.tabela === 'Liga' && c.metodo === 'PATCH' && /visibilidade/.test(c.corpo ?? ''))

      // Visitante e admin (a Central de Parametrização é do dono): sem acesso.
      sessao.token = null
      assert.equal((await patch(2, { visibilidade: 'PUBLICA' })).status, 401)
      sessao.token = await tokenAdmin()
      assert.equal((await patch(2, { visibilidade: 'PUBLICA' })).status, 401)
      // Outro organizador: 403 e nada gravado.
      sessao.token = await tokenOrg('org-2')
      assert.equal((await patch(2, { visibilidade: 'PUBLICA' })).status, 403)
      assert.equal(gravacoes().length, 0)

      // Dono.
      sessao.token = await tokenOrg('org-1')
      assert.equal((await patch(1, { visibilidade: 'TALVEZ' })).status, 422, 'valor fora da lista')
      assert.equal(gravacoes().length, 0)
      const ok = await patch(1, { visibilidade: 'PRIVADA' })
      assert.equal(ok.status, 200)
      assert.equal(((await ok.json()) as { data: { visibilidade: string } }).data.visibilidade, 'PRIVADA')
      assert.equal(gravacoes().length, 1)
      assert.deepEqual(JSON.parse(gravacoes()[0].corpo as string), { visibilidade: 'PRIVADA' })

      // Leitura devolve o valor gravado.
      const leitura = await GET(new NextRequest(`${BASE}/api/organizador/ligas/2/setup/inscricoes?categoriaCampeonatoId=${CATEGORIA}`), contexto(2))
      assert.equal(leitura.status, 200)
      assert.equal(((await leitura.json()) as { data: { visibilidade: string } }).data.visibilidade, 'PRIVADA')
    } finally {
      rede.restaurar()
      sessao.token = null
    }

    // Coluna ausente: a leitura segue com PUBLICA; a gravação explica o que falta.
    const rede2 = instalar(tabelasBase(), { semColuna: true })
    try {
      const { GET, PATCH } = await import('../src/app/api/organizador/ligas/[id]/setup/inscricoes/route')
      sessao.token = await tokenOrg('org-1')
      const leitura = await GET(new NextRequest(`${BASE}/api/organizador/ligas/2/setup/inscricoes?categoriaCampeonatoId=${CATEGORIA}`), { params: Promise.resolve({ id: '2' }) })
      assert.equal(leitura.status, 200)
      assert.equal(((await leitura.json()) as { data: { visibilidade: string } }).data.visibilidade, 'PUBLICA')
      const gravacao = await PATCH(new NextRequest(`${BASE}/api/organizador/ligas/2/setup/inscricoes`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibilidade: 'PRIVADA' }),
      }), { params: Promise.resolve({ id: '2' }) })
      assert.equal(gravacao.status, 503)
      assert.match(((await gravacao.json()) as { error: string }).error, /privada/i)
    } finally {
      rede2.restaurar()
      sessao.token = null
    }
  }

  // ---------------------------------------------------------------- (d) links de inscrição da privada
  {
    const rede = instalar(tabelasBase(), { semColuna: false })
    try {
      const { GET } = await import('../src/app/api/organizador/ligas/[id]/links-categoria/route')
      const ler = async (id: number, token: string | null) => {
        sessao.token = token
        const resposta = await GET(new NextRequest(`${BASE}/api/organizador/ligas/${id}/links-categoria`), { params: Promise.resolve({ id: String(id) }) })
        return { status: resposta.status, corpo: (await resposta.json()) as { data?: Array<Record<string, unknown>> } }
      }
      assert.equal((await ler(2, null)).status, 401)
      assert.equal((await ler(2, await tokenOrg('org-2'))).status, 403)
      const semLink = await ler(2, await tokenOrg('org-1'))
      assert.equal(semLink.status, 200)
      const item = semLink.corpo.data?.[0] as Record<string, unknown>
      assert.equal(item.privada, true)
      assert.equal(item.semLink, true)
      assert.equal(item.caminho, null)
      assert.match(String(item.mensagem), /gere o link/i)
      const comLink = await ler(1, await tokenOrg('org-1'))
      const aberto = comLink.corpo.data?.[0] as Record<string, unknown>
      assert.equal(aberto.privada, false)
      assert.equal(aberto.semLink, false)
      assert.equal(aberto.mensagem, null)
      assert.equal(aberto.caminho, '/inscricao/categoria/tok-livre')
    } finally {
      rede.restaurar()
      sessao.token = null
    }
  }

  // A mensagem do servidor para quem tenta inscrever numa privada sem link.
  const { avaliarConvite } = await import('../src/lib/meu-time/convite')
  const vazio = { tokenCategoria: null, linkCampeonato: null, visibilidade: 'PRIVADA' }
  const semConvite = avaliarConvite(undefined, vazio)
  assert.equal(!semConvite.ok && semConvite.codigo, 'CONVITE_OBRIGATORIO')
  assert.match(!semConvite.ok ? semConvite.mensagem : '', /ainda não emitiu o link/)
  const comConvite = avaliarConvite('x', vazio)
  assert.equal(!comConvite.ok && comConvite.codigo, 'CONVITE_INVALIDO')
  assert.match(!comConvite.ok ? comConvite.mensagem : '', /ainda não emitiu o link/)
  const comLinkEmitido = avaliarConvite('x', { ...vazio, tokenCategoria: 'abc' })
  assert.doesNotMatch(!comLinkEmitido.ok ? comLinkEmitido.mensagem : '', /ainda não emitiu/)

  console.log('competicao-privada-r7: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
