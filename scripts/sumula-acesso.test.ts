import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.JWT_SECRET ||= 'teste-local-jwt-secret-32-chars-min'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sumula-acesso-teste.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-teste-sumula-acesso'
process.env.NEXT_PUBLIC_SUPABASE_ALVO = 'desenvolvimento'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-teste-sumula-acesso'
delete process.env.VERCEL_ENV
delete process.env.NEXT_PUBLIC_VERCEL_ENV

const HOST = 'https://sumula-acesso-teste.supabase.co/'
const TOKEN = 'tok_Aleatorio-Opaco_0123456789abcdefghijklmnopqrstuv'
const TOKEN_EXPIRADO = 'tok_Expirado-Opaco_0123456789abcdefghijklmnopqrstuv'

const PII = {
  cpf: '12345678900',
  documentoTipo: 'RG',
  documentoNumero: '99887766',
  dataNascimento: '2010-01-01',
  telefone: '11999990000',
  telefoneEmergencia: '11888880000',
  documentosUrls: '["https://x/doc.pdf"]',
  qrCodeToken: 'qr-secreto',
}
const CHAVES_PROIBIDAS = [...Object.keys(PII), 'sumulaToken', 'sumulaTokenExpira', 'organizadorId', 'email', 'telefone']

function jogador(id: number) {
  return { id, nome: `Atleta ${id}`, numero: id, posicao: 'P', fotoUrl: 'https://x/f.png', equipeId: 1, ...PII }
}

function partidaDoBanco(over: Record<string, unknown> = {}, liga: Record<string, unknown> = {}) {
  return {
    id: 1,
    ligaId: 7,
    rodada: 1,
    fase: 'GERAL',
    status: 'ENCERRADA',
    categoria: 'Adulto',
    dataHora: '2026-10-01T15:00:00.000Z',
    localNome: 'Ginásio',
    setsPorA: 2,
    setsPorB: 0,
    pontosPorA: 50,
    pontosPorB: 30,
    vencedorId: 1,
    sumulaToken: TOKEN,
    sumulaTokenExpira: null,
    sumulaAprovadaEm: '2026-10-01T16:00:00.000Z',
    liga: { id: 7, nome: 'Copa', status: 'ATIVA', simulacao: false, organizadorId: 'org-1', ...liga },
    equipeA: { id: 1, nome: 'A', logoUrl: null, corHex: '#111', lider: 'Fulano', jogadores: [jogador(10)] },
    equipeB: { id: 2, nome: 'B', logoUrl: null, corHex: '#222', jogadores: [jogador(20)] },
    presencas: [{ id: 1, presente: true, equipeId: 1, jogadorId: 10, numero: 10, jogador: jogador(10) }],
    sets: [{ id: 1, numero: 1, pontosA: 25, pontosB: 15 }],
    ocorrencias: [],
    destaques: [{ id: 1, tipo: 'MVP', jogador: jogador(10) }],
    escala: [{ id: 1, cargo: 'PRIMEIRO_ARBITRO', arbitroId: 3, arbitro: { id: 3, nome: 'Juiz', email: 'juiz@x.com', telefone: '1' } }],
    ...over,
  }
}

const tabelaPartidas: Array<ReturnType<typeof partidaDoBanco>> = []
const consultas: string[] = []

function instalarFetch() {
  const original = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith(HOST)) throw new Error(`fetch fora do teste: ${url}`)
    const parsed = new URL(url)
    const tabela = decodeURIComponent(parsed.pathname.replace('/rest/v1/', ''))
    let corpo: unknown[] = []
    if (tabela === 'Partida') {
      consultas.push(parsed.search)
      const id = parsed.searchParams.get('id')
      const sumulaToken = parsed.searchParams.get('sumulaToken')
      corpo = tabelaPartidas.filter((p) => (id ? `eq.${p.id}` === id : sumulaToken ? `eq.${p.sumulaToken}` === sumulaToken : false))
    }
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return () => { globalThis.fetch = original }
}

function chavesDe(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((item) => chavesDe(item, acc))
  else if (valor && typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) {
      acc.push(chave)
      chavesDe(item, acc)
    }
  }
  return acc
}

function semPii(json: unknown, onde: string) {
  const chaves = chavesDe(json)
  for (const proibida of CHAVES_PROIBIDAS) assert.equal(chaves.includes(proibida), false, `${onde}: ${proibida}`)
  const texto = JSON.stringify(json)
  for (const valor of ['12345678900', '99887766', '11999990000', 'qr-secreto', TOKEN, 'juiz@x.com', 'org-1']) {
    assert.equal(texto.includes(valor), false, `${onde}: ${valor}`)
  }
}

async function main() {
  const { demoSumulaLiberado } = await import('../src/lib/sumula-demo')
  const { campeonatoPublicado } = await import('../src/lib/campeonato-publico')
  const { tokenOpacoValido } = await import('../src/lib/sumula-access')
  const { CAMPOS_PROIBIDOS_CONSULTA, PARTIDA_CONSULTA_COLUNAS } = await import('../src/lib/sumula-consulta')
  const sumula = await import('../src/app/api/sumula/[token]/route')
  const publica = await import('../src/app/api/partidas/[id]/sumula-publica/route')

  // Projeção declarada não cita nenhum campo proibido.
  for (const campo of CAMPOS_PROIBIDOS_CONSULTA) {
    if (campo === 'email' || campo === 'telefone') continue
    assert.equal(PARTIDA_CONSULTA_COLUNAS.split(/[(),:]/).includes(campo), false, `select cita ${campo}`)
  }
  assert.equal(PARTIDA_CONSULTA_COLUNAS.includes('*'), false)

  // Demo: só fora de produção e de preview.
  assert.equal(demoSumulaLiberado('token-demo-1-luva2026', { NODE_ENV: 'development' }), true)
  assert.equal(demoSumulaLiberado('token-demo-1-luva2026', { NODE_ENV: 'production' }), false)
  assert.equal(demoSumulaLiberado('token-demo-1-luva2026', { NODE_ENV: 'test', VERCEL_ENV: 'production' }), false)
  assert.equal(demoSumulaLiberado('token-demo-1-luva2026', { NODE_ENV: 'test', VERCEL_ENV: 'preview' }), false)
  assert.equal(demoSumulaLiberado('qualquer', { NODE_ENV: 'development' }), false)

  // Token opaco nunca é só dígitos.
  assert.equal(tokenOpacoValido('1'), false)
  assert.equal(tokenOpacoValido('0042'), false)
  assert.equal(tokenOpacoValido(TOKEN), true)
  assert.equal(tokenOpacoValido('luv-12-g1-r1-3-4'), true)
  assert.equal(tokenOpacoValido('a b'), false)
  assert.equal(tokenOpacoValido(''), false)

  // Campeonato publicado.
  assert.equal(campeonatoPublicado({ status: 'ATIVA' }), true)
  assert.equal(campeonatoPublicado({ status: 'FINALIZADO' }), true)
  assert.equal(campeonatoPublicado({ status: 'RASCUNHO' }), false)
  assert.equal(campeonatoPublicado({ status: 'ATIVA', simulacao: true }), false)
  assert.equal(campeonatoPublicado(null), false)

  const restaurar = instalarFetch()
  try {
    const chamarToken = (token: string, consulta = true) => sumula.GET(
      new NextRequest(`http://127.0.0.1:3001/api/sumula/${token}${consulta ? '?consulta=1' : ''}`),
      { params: Promise.resolve({ token }) },
    )
    const chamarPublica = (id: string) => publica.GET(
      new NextRequest(`http://127.0.0.1:3001/api/partidas/${id}/sumula-publica`),
      { params: Promise.resolve({ id }) },
    )

    tabelaPartidas.push(partidaDoBanco())
    tabelaPartidas.push(partidaDoBanco({ id: 2, sumulaToken: 'tok_rascunho_0123456789' }, { status: 'RASCUNHO' }))
    tabelaPartidas.push(partidaDoBanco({ id: 3, sumulaToken: 'tok_simulacao_0123456789' }, { simulacao: true }))
    tabelaPartidas.push(partidaDoBanco({ id: 4, sumulaToken: TOKEN_EXPIRADO, sumulaTokenExpira: '2020-01-01T00:00:00.000Z' }))

    // GET /api/sumula/{id numérico}: 404, sem consultar o banco, igual ao token inexistente.
    for (const id of ['1', '2', '3', '4', '50', '100']) {
      consultas.length = 0
      const resposta = await chamarToken(id)
      assert.equal(resposta.status, 404, `id ${id}`)
      assert.equal(consultas.length, 0, `id ${id} não deve consultar Partida`)
    }
    const numerico = await chamarToken('1', false)
    const inexistente = await chamarToken('tok_inexistente_0123456789')
    assert.equal(numerico.status, 404)
    assert.equal(inexistente.status, 404)
    assert.deepEqual(await numerico.json(), await inexistente.json(), '404 idêntico')

    // Token válido: 200 e consulta sem dado pessoal, mesmo que o banco devolva PII.
    const consulta = await chamarToken(TOKEN)
    assert.equal(consulta.status, 200)
    const json = await consulta.json()
    assert.equal(json.data.id, 1)
    assert.equal(json.data.equipeA.jogadores[0].nome, 'Atleta 10')
    semPii(json, 'consulta por token')

    // Sem ?consulta=1 a leitura completa exige sessão.
    const completa = await chamarToken(TOKEN, false)
    assert.equal(completa.status, 401)

    // Token expirado: 410.
    assert.equal((await chamarToken(TOKEN_EXPIRADO)).status, 410)

    // Token demo fora de produção responde; em produção cai no 404 comum.
    const nodeEnv = process.env as Record<string, string | undefined>
    const anterior = nodeEnv.NODE_ENV
    nodeEnv.NODE_ENV = 'development'
    assert.equal((await chamarToken('token-demo-1-luva2026', false)).status, 200)
    nodeEnv.NODE_ENV = 'production'
    assert.equal((await chamarToken('token-demo-1-luva2026', false)).status, 404)
    assert.equal((await chamarToken('token-demo-1-luv2026')).status, 404)
    nodeEnv.NODE_ENV = anterior

    // Rota pública por id: só campeonato publicado, sem dado pessoal.
    const publicaOk = await chamarPublica('1')
    assert.equal(publicaOk.status, 200)
    assert.equal(publicaOk.headers.get('cache-control'), 'private, no-store')
    const corpoPublico = await publicaOk.json()
    assert.equal(corpoPublico.data.liga.nome, 'Copa')
    assert.equal(corpoPublico.data.equipeA.jogadores[0].numero, 10)
    semPii(corpoPublico, 'rota pública')
    assert.equal(consultas.at(-1)?.includes('sumulaToken'), false, 'a rota pública não pede sumulaToken')
    assert.equal(consultas.at(-1)?.includes('cpf'), false)

    const respostasRuins = [await chamarPublica('2'), await chamarPublica('3'), await chamarPublica('999'), await chamarPublica('abc'), await chamarPublica('1; drop')]
    for (const resposta of respostasRuins) assert.equal(resposta.status, 404)
    const corpos = await Promise.all(respostasRuins.map((r) => r.json()))
    for (const c of corpos) assert.deepEqual(c, corpos[0], '404 idêntico na rota pública')
  } finally {
    restaurar()
  }

  console.log('sumula-acesso: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
