import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

const UUID = '0b9f3b2e-6a5c-4c1e-9d2f-1a2b3c4d5e6f'

type Sessao = { userId: string; email: string; nome: string; tipo: string; status: string; trocarSenha?: boolean } | null
let sessaoAtual: Sessao = null
let sessaoLink: { acessoId: string; partidaId: number; token: string } | null = null

function sessao(tipo: string, userId: string): Sessao {
  return { userId, email: `${userId}@teste.local`, nome: userId, tipo, status: 'ATIVA' }
}

async function main() {
  const config = await import('../src/lib/uploads/config')
  const { validarSolicitacaoUpload } = await import('../src/lib/uploads/validacao')
  const caminhos = await import('../src/lib/uploads/caminho')
  const limites = await import('../src/lib/rate-limit')

  // A sessão vem do cookie, que só existe dentro de uma requisição real do Next. Nos testes
  // trocamos as duas leituras de sessão; o resto (banco, autorização, storage) é o código real.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const auth = require('../src/lib/auth')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const acessoJogo = require('../src/lib/acesso-arbitro-jogo')
  auth.verifyPublicToken = async () => sessaoAtual
  acessoJogo.lerSessaoAcesso = async () => sessaoLink

  // 1. Validação de MIME e tamanho.
  const MB = 1024 * 1024
  const ok = (tipo: 'atleta-documento' | 'atleta-foto-rosto' | 'equipe-emblema', mime: unknown, tamanho: unknown) => validarSolicitacaoUpload({ tipo, mime, tamanho })
  assert.equal(ok('atleta-documento', 'application/pdf', 8 * MB).ok, true)
  assert.equal(ok('atleta-documento', 'IMAGE/JPEG', 1000).ok, true)
  assert.deepEqual(pick(ok('atleta-documento', 'application/pdf', 8 * MB + 1)), { ok: false, status: 413 })
  assert.deepEqual(pick(ok('atleta-foto-rosto', 'application/pdf', 1000)), { ok: false, status: 415 })
  assert.deepEqual(pick(ok('atleta-foto-rosto', 'image/png', 4 * MB + 1)), { ok: false, status: 413 })
  assert.equal(ok('atleta-foto-rosto', 'image/png', 4 * MB).ok, true)
  assert.equal(ok('equipe-emblema', 'image/webp', 100).ok, true)
  for (const mime of ['image/svg+xml', 'text/html', 'application/x-msdownload', 'application/octet-stream', '', undefined, 42, 'image/jpeg; charset=x']) {
    assert.deepEqual(pick(ok('atleta-documento', mime, 100)), { ok: false, status: 415 }, String(mime))
  }
  for (const tamanho of [0, -5, 1.5, 'abc', undefined, NaN, Infinity]) {
    assert.deepEqual(pick(ok('atleta-documento', 'application/pdf', tamanho)), { ok: false, status: 422 }, String(tamanho))
  }
  assert.equal(config.tipoDeUploadValido('atleta-documento'), true)
  assert.equal(config.tipoDeUploadValido('__proto__'), false)
  assert.equal(config.tipoDeUploadValido('constructor'), false)
  assert.equal(config.TIPOS_UPLOAD['atleta-documento'].privado, true)
  assert.equal(config.TIPOS_UPLOAD['atleta-foto-rosto'].privado, false)

  // 2. Caminho amarrado ao dono.
  const caminho = caminhos.montarCaminhoUpload({ tipo: 'atleta-documento', ligaId: 7, equipeId: 1, extensao: 'pdf', id: UUID })
  assert.equal(caminho, `atleta-documento/liga-7/equipe-1/${UUID}.pdf`)
  assert.deepEqual(caminhos.lerCaminhoUpload(caminho), { tipo: 'atleta-documento', ligaId: 7, equipeId: 1, arquivo: `${UUID}.pdf` })
  for (const ruim of [
    `atleta-documento/liga-7/equipe-1/../equipe-2/${UUID}.pdf`,
    `atleta-documento/liga-7/equipe-1/${UUID}.exe`,
    `atleta-documento/liga-7/equipe-1/nome-livre.pdf`,
    `/atleta-documento/liga-7/equipe-1/${UUID}.pdf`,
    `outro-tipo/liga-7/equipe-1/${UUID}.pdf`,
    `atleta-documento/liga-7/equipe-1/${UUID}.pdf/extra`,
    'cand-1/documento/123-rg.pdf',
    '',
    null,
    123,
  ]) {
    assert.equal(caminhos.lerCaminhoUpload(ruim), null, String(ruim))
  }
  const bucket = 'atleta-arquivos'
  assert.equal(caminhos.caminhoDoValorArmazenado(`https://x.supabase.co/storage/v1/object/public/${bucket}/cand-1/documento/a%20b.pdf`, bucket), 'cand-1/documento/a b.pdf')
  assert.equal(caminhos.caminhoDoValorArmazenado('cand-1/documento/a.pdf', bucket), 'cand-1/documento/a.pdf')
  assert.equal(caminhos.caminhoDoValorArmazenado('https://evil.example/a.pdf', bucket), null)
  assert.equal(caminhos.caminhoDoValorArmazenado('https://x.supabase.co/storage/v1/object/public/outro-bucket/a.pdf', bucket), null)
  assert.equal(caminhos.caminhoDoValorArmazenado('../outra/equipe.pdf', bucket), null)
  assert.equal(caminhos.caminhoDoValorArmazenado('https://x.supabase.co/storage/v1/object/public/atleta-arquivos/%2e%2e/x.pdf', bucket), null)
  assert.equal(caminhos.caminhoDoValorArmazenado('', bucket), null)

  // 3. Rotas com banco e storage falsos.
  const tabelas: Tabelas = {
    Liga: [{ id: 7, organizadorId: 'org-A' }, { id: 8, organizadorId: 'org-B' }],
    Equipe: [{ id: 1, ligaId: 7 }, { id: 2, ligaId: 8 }],
    CandidaturaEquipe: [{ id: 'cap-1', equipeId: 1 }, { id: 'cap-2', equipeId: 2 }, { id: 'cap-sem', equipeId: null }],
    CandidaturaArbitro: [{ id: 'arb-1', arbitroId: 30 }, { id: 'arb-2', arbitroId: 31 }],
    Partida: [{ id: 50, equipeAId: 1, equipeBId: 2 }],
    EscalaArbitro: [{ id: 1, arbitroId: 30, partidaId: 50 }],
    AcessoArbitroJogo: [{ id: 'link-1', partidaId: 50, token: 'tk', ativo: true, revogadoEm: null }],
    Jogador: [{
      id: 10,
      equipeId: 1,
      documentosUrls: JSON.stringify([
        'https://x.supabase.co/storage/v1/object/public/atleta-arquivos/cand-1/documento/123-rg.pdf',
        'https://evil.example/a.pdf',
      ]),
    }],
  }
  const assinados: string[] = []
  const lidos: string[] = []
  const falso = instalarPostgrestFalso(tabelas, {
    storage: (destino) => {
      const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } })
      if (destino.startsWith('/storage/v1/object/upload/sign/')) {
        assinados.push(decodeURIComponent(destino.replace('/storage/v1/object/upload/sign/', '').split('?')[0]))
        return json({ url: `/object/upload/sign/x?token=tok-teste` })
      }
      if (destino.startsWith('/storage/v1/object/sign/')) {
        lidos.push(decodeURIComponent(destino.replace('/storage/v1/object/sign/', '').split('?')[0]))
        return json({ signedURL: '/object/sign/x?token=leitura-teste' })
      }
      return null
    },
  })
  try {
    const assinar = await import('../src/app/api/uploads/assinar/route')
    const documento = await import('../src/app/api/uploads/documento/route')
    const post = (corpo: unknown) => assinar.POST(new NextRequest('http://127.0.0.1:3001/api/uploads/assinar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    }))
    const ler = (consulta: string) => documento.GET(new NextRequest(`http://127.0.0.1:3001/api/uploads/documento?${consulta}`))
    const pedido = { tipo: 'atleta-documento', equipeId: 1, mime: 'application/pdf', tamanho: 1000 }

    // 3a. Envio: validação antes da posse, posse antes de assinar.
    sessaoAtual = null
    limites.reiniciarCotas()
    assert.equal((await post(pedido)).status, 401, 'sem sessão')
    assert.equal((await post({ ...pedido, mime: 'text/html' })).status, 415)
    assert.equal((await post({ ...pedido, tamanho: 9 * MB })).status, 413)
    assert.equal((await post({ ...pedido, tipo: 'qualquer' })).status, 422)
    assert.equal((await post({ ...pedido, equipeId: 999 })).status, 404)
    assert.equal((await post('lixo')).status, 422)
    assert.equal(assinados.length, 0, 'nada assinado sem posse')

    sessaoAtual = sessao('equipe', 'cap-2')
    assert.equal((await post(pedido)).status, 403, 'capitão de outra equipe')
    sessaoAtual = sessao('organizador', 'org-B')
    assert.equal((await post(pedido)).status, 403, 'organizador de outro campeonato')
    sessaoAtual = sessao('arbitro', 'arb-1')
    assert.equal((await post(pedido)).status, 403, 'árbitro não envia arquivo')
    sessaoAtual = { ...sessao('organizador', 'org-A')!, trocarSenha: true }
    assert.equal((await post(pedido)).status, 403, 'organizador com senha a trocar')
    sessaoAtual = { ...sessao('equipe', 'cap-1')!, status: 'PENDENTE' }
    assert.equal((await post(pedido)).status, 403, 'capitão não liberado')
    assert.equal(assinados.length, 0)

    sessaoAtual = sessao('equipe', 'cap-1')
    const enviado = await post(pedido)
    assert.equal(enviado.status, 201)
    assert.equal(enviado.headers.get('cache-control'), 'private, no-store')
    const corpo = (await enviado.json()).data
    assert.equal(corpo.bucket, 'atleta-arquivos')
    assert.equal(corpo.token, 'tok-teste')
    assert.equal(corpo.urlPublica, null, 'documento é privado')
    assert.equal(corpo.tamanhoMaximo, 8 * MB)
    assert.match(corpo.caminho, /^atleta-documento\/liga-7\/equipe-1\/[0-9a-f-]{36}\.pdf$/)
    assert.equal(assinados.length, 1)
    assert.equal(assinados[0], `atleta-arquivos/${corpo.caminho}`)

    sessaoAtual = sessao('organizador', 'org-A')
    const rosto = await post({ tipo: 'atleta-foto-rosto', equipeId: 1, mime: 'image/webp', tamanho: 5000 })
    assert.equal(rosto.status, 201)
    const rostoCorpo = (await rosto.json()).data
    assert.equal(rostoCorpo.bucket, 'jogador-fotos-rosto')
    assert.match(rostoCorpo.urlPublica, /jogador-fotos-rosto\/atleta-foto-rosto\/liga-7\/equipe-1\//)
    // A equipe do corpo define o caminho; o organizador A não assina para a equipe da liga B.
    assert.equal((await post({ ...pedido, equipeId: 2 })).status, 403)

    // 3b. Leitura de documento.
    const caminhoDoc = `atleta-documento/liga-7/equipe-1/${UUID}.pdf`
    sessaoAtual = null
    assert.equal((await ler(`caminho=${encodeURIComponent(caminhoDoc)}`)).status, 401)
    assert.equal(lidos.length, 0)

    for (const [rotulo, quem] of [['capitão da equipe', sessao('equipe', 'cap-1')], ['organizador dono', sessao('organizador', 'org-A')], ['árbitro escalado', sessao('arbitro', 'arb-1')]] as const) {
      sessaoAtual = quem
      const resposta = await ler(`caminho=${encodeURIComponent(caminhoDoc)}`)
      assert.equal(resposta.status, 200, rotulo)
      assert.equal(resposta.headers.get('cache-control'), 'private, no-store')
      const json = await resposta.json()
      assert.match(json.data.url, /leitura-teste/)
      assert.ok(new Date(json.data.expiraEm).getTime() - Date.now() <= 120_000 + 1000, 'validade curta')
    }
    assert.equal(lidos.length, 3)
    assert.equal(lidos[0], `atleta-arquivos/${caminhoDoc}`)

    const negados: Array<[string, Sessao]> = [
      ['capitão de outra equipe', sessao('equipe', 'cap-2')],
      ['capitão sem equipe', sessao('equipe', 'cap-sem')],
      ['organizador de outro campeonato', sessao('organizador', 'org-B')],
      ['árbitro não escalado', sessao('arbitro', 'arb-2')],
      ['atleta/público', sessao('publico', 'qualquer')],
      ['quadra', sessao('quadra', 'qualquer')],
    ]
    for (const [rotulo, quem] of negados) {
      sessaoAtual = quem
      lidos.length = 0
      assert.equal((await ler(`caminho=${encodeURIComponent(caminhoDoc)}`)).status, 403, rotulo)
      assert.equal(lidos.length, 0, `${rotulo}: não assina`)
    }

    // Árbitro que entrou pelo link do jogo vale só para as equipes daquele jogo.
    sessaoAtual = null
    sessaoLink = { acessoId: 'link-1', partidaId: 50, token: 'tk' }
    assert.equal((await ler(`caminho=${encodeURIComponent(caminhoDoc)}`)).status, 200, 'árbitro pelo link do jogo')
    sessaoLink = { acessoId: 'link-1', partidaId: 50, token: 'token-errado' }
    assert.equal((await ler(`caminho=${encodeURIComponent(caminhoDoc)}`)).status, 403, 'link com token errado')
    sessaoLink = null

    // Caminhos que não são documento no formato novo: 404 sem tocar no storage.
    sessaoAtual = sessao('organizador', 'org-A')
    lidos.length = 0
    for (const ruim of [
      `atleta-foto-rosto/liga-7/equipe-1/${UUID}.png`,
      `atleta-documento/liga-7/equipe-1/../equipe-2/${UUID}.pdf`,
      'cand-1/documento/123-rg.pdf',
      `atleta-documento/liga-7/equipe-999/${UUID}.pdf`,
    ]) {
      assert.equal((await ler(`caminho=${encodeURIComponent(ruim)}`)).status, 404, ruim)
    }
    assert.equal((await ler('')).status, 422)
    assert.equal(lidos.length, 0)

    // Modo jogadorId: documento gravado com URL pública antiga; só o que vem do bucket privado.
    sessaoAtual = sessao('equipe', 'cap-1')
    const porJogador = await ler('jogadorId=10&indice=0')
    assert.equal(porJogador.status, 200)
    assert.equal(lidos.at(-1), 'atleta-arquivos/cand-1/documento/123-rg.pdf')
    assert.equal((await ler('jogadorId=10&indice=1')).status, 404, 'URL de outro host')
    assert.equal((await ler('jogadorId=10&indice=5')).status, 404, 'índice inexistente')
    assert.equal((await ler('jogadorId=999&indice=0')).status, 404)
    sessaoAtual = sessao('equipe', 'cap-2')
    assert.equal((await ler('jogadorId=10&indice=0')).status, 403, 'capitão de outra equipe lendo documento de atleta alheio')
  } finally {
    falso.restaurar()
  }

  console.log('uploads-assinados: ok')
}

function pick(resultado: { ok: boolean; status?: number }) {
  return resultado.ok ? { ok: true } : { ok: false, status: resultado.status }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
