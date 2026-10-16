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

const UUID = '0b9f3b2e-6a5c-4c1e-9d2f-1a2b3c4d5e6f'
const MB = 1024 * 1024

async function main() {
  const config = await import('../src/lib/uploads/config')
  const { validarSolicitacaoUpload } = await import('../src/lib/uploads/validacao')
  const caminhos = await import('../src/lib/uploads/caminho')
  const documentos = await import('../src/lib/uploads/documentos')
  const limites = await import('../src/lib/rate-limit')
  const { signPublicToken } = await import('../src/lib/auth')

  // 1. Limites por tipo, validados no servidor.
  const v = (tipo: Parameters<typeof validarSolicitacaoUpload>[0]['tipo'], mime: unknown, tamanho: unknown) => validarSolicitacaoUpload({ tipo, mime, tamanho })
  assert.equal(v('candidatura-emblema', 'image/png', 4 * MB).ok, true)
  assert.equal(v('candidatura-emblema', 'image/png', 4 * MB + 1).ok, false)
  assert.equal(v('candidatura-emblema', 'application/pdf', 100).ok, false)
  assert.equal(v('quadra-foto', 'image/jpeg', 5 * MB).ok, true)
  assert.equal(v('quadra-foto', 'image/jpeg', 5 * MB + 1).ok, false)
  assert.equal(v('quadra-foto', 'image/gif', 100).ok, false)
  assert.equal(v('galeria-campeonato', 'image/webp', 4 * MB).ok, true)
  assert.equal(v('galeria-campeonato', 'image/svg+xml', 100).ok, false)
  assert.equal(v('organizador-logo', 'image/webp', 4 * MB + 1).ok, false)
  assert.equal(v('organizador-logo', 'text/html', 100).ok, false)
  assert.equal(config.TIPOS_UPLOAD['quadra-foto'].bucket, 'quadra-fotos')
  assert.equal(config.TIPOS_UPLOAD['galeria-campeonato'].bucket, 'galeria-campeonato')
  assert.equal(config.TIPOS_UPLOAD['organizador-logo'].bucket, 'organizador-logos')
  assert.equal(config.tipoDeEquipe('quadra-foto'), false)
  assert.equal(config.tipoDeEquipe('equipe-emblema'), true)

  // 2. Caminhos amarrados ao dono.
  assert.equal(caminhos.montarCaminhoDono({ tipo: 'candidatura-emblema', extensao: 'webp', id: UUID }), `candidatura-emblema/anonimo/${UUID}.webp`)
  assert.equal(caminhos.montarCaminhoDono({ tipo: 'quadra-foto', usuarioId: 'cand-1', extensao: 'jpg', id: UUID }), `quadra-foto/usuario-cand-1/${UUID}.jpg`)
  assert.equal(caminhos.montarCaminhoDono({ tipo: 'galeria-campeonato', ligaId: 7, extensao: 'webp', id: UUID }), `ligas/7/${UUID}.webp`)
  assert.equal(caminhos.montarCaminhoDono({ tipo: 'organizador-logo', organizadorId: 'org-A', extensao: 'png', id: UUID }), `organizador-logo/organizador-org-A/${UUID}.png`)
  assert.throws(() => caminhos.montarCaminhoDono({ tipo: 'quadra-foto', usuarioId: '../x', extensao: 'jpg' }))
  assert.throws(() => caminhos.montarCaminhoDono({ tipo: 'organizador-logo', organizadorId: 'a/b', extensao: 'jpg' }))
  assert.throws(() => caminhos.montarCaminhoDono({ tipo: 'galeria-campeonato', extensao: 'jpg' }))
  assert.throws(() => caminhos.montarCaminhoDono({ tipo: 'equipe-emblema', extensao: 'jpg' }))
  // Tipos novos não passam como caminho de equipe.
  assert.equal(caminhos.lerCaminhoUpload(`quadra-foto/liga-7/equipe-1/${UUID}.jpg`), null)

  // 3. Rota de assinatura.
  const tabelas: Tabelas = {
    Liga: [{ id: 7, organizadorId: 'org-A' }, { id: 8, organizadorId: 'org-B' }],
    Equipe: [{ id: 1, ligaId: 7 }],
    CandidaturaEquipe: [{ id: 'cap-sem', equipeId: null }, { id: 'cap-com', equipeId: 1 }],
  }
  const assinados: string[] = []
  const falso = instalarPostgrestFalso(tabelas, {
    storage: (destino) => {
      if (destino.startsWith('/storage/v1/object/upload/sign/')) {
        assinados.push(decodeURIComponent(destino.replace('/storage/v1/object/upload/sign/', '').split('?')[0]))
        return new Response(JSON.stringify({ url: '/object/upload/sign/x?token=tok-teste' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return null
    },
  })
  try {
    const assinar = await import('../src/app/api/uploads/assinar/route')
    const entrar = (tipo: string, userId: string, extra: Record<string, unknown> = {}) =>
      signPublicToken({ userId, email: `${userId}@t.local`, nome: userId, tipo: tipo as 'organizador', status: 'ATIVA', ...extra })
    const post = (corpo: unknown, token?: string, ip = '10.0.0.1') => {
      sessao.token = token ?? null
      return assinar.POST(new NextRequest('http://127.0.0.1:3001/api/uploads/assinar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(corpo),
    }))
    }
    const imagem = { mime: 'image/webp', tamanho: 5000 }
    limites.reiniciarCotas()

    // Candidatura anônima: caminho temporário escolhido pelo servidor.
    const emblema = await post({ tipo: 'candidatura-emblema', ...imagem })
    assert.equal(emblema.status, 201)
    const emblemaCorpo = (await emblema.json()).data
    assert.equal(emblemaCorpo.bucket, 'equipe-emblemas')
    assert.match(emblemaCorpo.caminho, /^candidatura-emblema\/anonimo\/[0-9a-f-]{36}\.webp$/)
    assert.match(emblemaCorpo.urlPublica, /equipe-emblemas\/candidatura-emblema\/anonimo\//)
    // Campos de dono mandados pelo cliente não mudam o caminho.
    const tentativa = await post({ tipo: 'quadra-foto', ...imagem, equipeId: 1, ligaId: 8 })
    assert.equal(tentativa.status, 201)
    assert.match((await tentativa.json()).data.caminho, /^quadra-foto\/anonimo\//)
    // Com sessão liberada o caminho passa a ser do usuário.
    const comSessao = await post({ tipo: 'quadra-foto', ...imagem }, await entrar('equipe', 'cand-1'))
    assert.match((await comSessao.json()).data.caminho, /^quadra-foto\/usuario-cand-1\//)
    // Sessão não liberada volta a ser anônima, não ganha pasta própria.
    const pendente = await post({ tipo: 'quadra-foto', ...imagem }, await entrar('equipe', 'cand-9', { status: 'PENDENTE' }))
    assert.match((await pendente.json()).data.caminho, /^quadra-foto\/anonimo\//)
    // Validação do servidor.
    assert.equal((await post({ tipo: 'quadra-foto', mime: 'application/pdf', tamanho: 10 })).status, 415)
    assert.equal((await post({ tipo: 'quadra-foto', mime: 'image/png', tamanho: 6 * MB })).status, 413)

    // Limite por IP no cadastro: 30 por hora, só para esse IP.
    limites.reiniciarCotas()
    for (let i = 0; i < 30; i += 1) assert.equal((await post({ tipo: 'candidatura-emblema', ...imagem }, undefined, '10.9.9.9')).status, 201, `envio ${i}`)
    const barrado = await post({ tipo: 'candidatura-emblema', ...imagem }, undefined, '10.9.9.9')
    assert.equal(barrado.status, 429)
    assert.ok(barrado.headers.get('retry-after'))
    assert.equal((await post({ tipo: 'candidatura-emblema', ...imagem }, undefined, '10.9.9.8')).status, 201, 'outro IP')
    limites.reiniciarCotas()

    // Galeria: só o organizador dono da liga.
    const orgA = await entrar('organizador', 'org-A')
    const orgB = await entrar('organizador', 'org-B')
    const galeria = { tipo: 'galeria-campeonato', ligaId: 7, ...imagem }
    assinados.length = 0
    assert.equal((await post(galeria)).status, 401, 'sem sessão')
    assert.equal((await post(galeria, orgB)).status, 403, 'organizador de outra liga')
    assert.equal((await post(galeria, await entrar('equipe', 'cap-1'))).status, 401, 'capitão não é organizador')
    assert.equal((await post({ tipo: 'galeria-campeonato', ...imagem }, orgA)).status, 422, 'sem ligaId')
    assert.equal((await post({ ...galeria, ligaId: 999 }, orgA)).status, 404)
    assert.equal((await post(galeria, await entrar('organizador', 'org-A', { trocarSenha: true }))).status, 403)
    assert.equal(assinados.length, 0, 'nada assinado sem posse')
    const ok = await post(galeria, orgA)
    assert.equal(ok.status, 201)
    const galeriaCorpo = (await ok.json()).data
    assert.equal(galeriaCorpo.bucket, 'galeria-campeonato')
    assert.match(galeriaCorpo.caminho, /^ligas\/7\/[0-9a-f-]{36}\.webp$/)
    assert.equal(assinados[0], `galeria-campeonato/${galeriaCorpo.caminho}`)
    // O marcador que as rotas de galeria exigem continua valendo.
    assert.ok(galeriaCorpo.urlPublica.includes('/galeria-campeonato/ligas/7/'))

    // Logo: só o próprio organizador, caminho com o id dele.
    const logo = { tipo: 'organizador-logo', ...imagem }
    assert.equal((await post(logo)).status, 401)
    assert.equal((await post(logo, await entrar('equipe', 'cap-1'))).status, 401)
    assert.equal((await post(logo, await entrar('arbitro', 'arb-1'))).status, 401)
    const logoOk = await post({ ...logo, ligaId: 8 }, orgA)
    assert.equal(logoOk.status, 201)
    assert.match((await logoOk.json()).data.caminho, /^organizador-logo\/organizador-org-A\/[0-9a-f-]{36}\.webp$/)
    assert.equal((await post({ ...logo, mime: 'image/svg+xml' }, orgA)).status, 415)

    // Tipos de equipe continuam exigindo equipe existente.
    assert.equal((await post({ tipo: 'equipe-emblema', ...imagem })).status, 422)
    // B2: capitão sem equipe vinculada recebe mensagem de cadastro incompleto (409), não "dados inválidos".
    const semEquipe = await post({ tipo: 'atleta-foto-rosto', ...imagem }, await entrar('equipe', 'cap-sem'))
    assert.equal(semEquipe.status, 409)
    assert.match((await semEquipe.json()).error, /Cadastro incompleto/)
    assert.equal((await post({ tipo: 'atleta-foto-rosto', ...imagem }, await entrar('equipe', 'cap-com'))).status, 422, 'com equipe, faltou equipeId')
    assert.equal((await post({ tipo: 'equipe-emblema', ...imagem, equipeId: 999 })).status, 404)
    assert.equal((await post({ tipo: 'equipe-emblema', ...imagem, equipeId: 1 })).status, 401)
    assert.equal((await post({ tipo: 'equipe-emblema', ...imagem, equipeId: 1 }, orgA)).status, 201)
  } finally {
    falso.restaurar()
  }

  // 4. documentosUrls: caminho puro, URL antiga e legado.
  const equipe = { id: 1, ligaId: 7 }
  const proprio = `atleta-documento/liga-7/equipe-1/${UUID}.pdf`
  const bucketUrl = 'https://x.supabase.co/storage/v1/object/'
  assert.equal(documentos.normalizarDocumentoEntrada(proprio, equipe), proprio)
  assert.equal(documentos.normalizarDocumentoEntrada(`${bucketUrl}sign/atleta-arquivos/${proprio}`, equipe), proprio, 'referência sem token vira caminho')
  assert.equal(documentos.normalizarDocumentoEntrada(`${bucketUrl}public/atleta-arquivos/cand-1/documento/a.pdf`, equipe), null, 'URL antiga nova de legado (A2)')
  assert.equal(documentos.normalizarDocumentoEntrada(`${bucketUrl}public/atleta-arquivos/cand-1/documento/a.pdf`, equipe, ['cand-1/documento/a.pdf']), 'cand-1/documento/a.pdf', 'URL antiga já gravada')
  assert.equal(documentos.normalizarDocumentoEntrada('cand-1/documento/a.pdf', equipe), null, 'caminho legado desconhecido')
  assert.equal(documentos.normalizarDocumentoEntrada('cand-1/documento/a.pdf', equipe, ['cand-1/documento/a.pdf']), 'cand-1/documento/a.pdf', 'legado já gravado')
  assert.equal(documentos.normalizarDocumentoEntrada(`atleta-documento/liga-7/equipe-2/${UUID}.pdf`, equipe), null, 'outra equipe')
  assert.equal(documentos.normalizarDocumentoEntrada(`atleta-documento/liga-8/equipe-1/${UUID}.pdf`, equipe), null, 'outra liga')
  assert.equal(documentos.normalizarDocumentoEntrada(`atleta-foto-rosto/liga-7/equipe-1/${UUID}.png`, equipe), null, 'não é documento')
  assert.equal(documentos.normalizarDocumentoEntrada('atleta-documento/liga-7/equipe-1/../equipe-2/x.pdf', equipe), null)
  assert.equal(documentos.normalizarDocumentoEntrada('https://evil.example/a.pdf', equipe), null)
  // A2: URL do bucket com caminho legado de outro dono não é aceita; só o que já está gravado no atleta.
  const legadoAlheio = 'cand-9/documento/123-rg.pdf'
  for (const host of ['https://proj.supabase.co', 'http://proj.supabase.co', 'https://evil.example']) {
    const base = `${host}/storage/v1/object/public/atleta-arquivos`
    assert.equal(documentos.normalizarDocumentoEntrada(`${base}/${legadoAlheio}`, equipe), null, `legado por URL ${host}`)
    assert.equal(documentos.normalizarDocumentoEntrada(`${host}/storage/v1/object/sign/atleta-arquivos/${legadoAlheio}?token=x`, equipe), null)
    assert.equal(documentos.normalizarDocumentoEntrada(`${base}/atleta-documento/liga-7/equipe-2/${UUID}.pdf`, equipe), null, 'outra equipe por URL')
    assert.equal(documentos.normalizarDocumentoEntrada(`${base}/atleta-documento/liga-8/equipe-1/${UUID}.pdf`, equipe), null, 'outra liga por URL')
    assert.equal(documentos.normalizarDocumentoEntrada(`${base}/atleta-documento/liga-7/equipe-1/../equipe-2/x.pdf`, equipe), null, '.. por URL')
  }
  const urlLegada = `https://proj.supabase.co/storage/v1/object/public/atleta-arquivos/${legadoAlheio}`
  assert.equal(documentos.normalizarDocumentoEntrada(urlLegada, equipe, [legadoAlheio]), legadoAlheio, 'legado por URL já gravado no mesmo atleta')
  assert.equal(documentos.normalizarDocumentoEntrada(urlLegada, equipe, ['cand-9/documento/outro.pdf']), null, 'gravado é outro objeto')
  // B1: fotoRostoUrl só aceita caminho/URL do Storage do projeto, bucket de foto de rosto, da própria equipe.
  const fotos = await import('../src/lib/uploads/foto-rosto')
  const base = 'https://proj.supabase.co'
  const caminhoFoto = `atleta-foto-rosto/liga-7/equipe-1/${UUID}.png`
  const urlFoto = `${base}/storage/v1/object/public/jogador-fotos-rosto/${caminhoFoto}`
  assert.equal(fotos.normalizarFotoRostoEntrada(urlFoto, equipe, null, base), urlFoto)
  assert.equal(fotos.normalizarFotoRostoEntrada(caminhoFoto, equipe, null, base), urlFoto, 'caminho vira URL pública')
  assert.equal(fotos.normalizarFotoRostoEntrada('https://old.example/foto.png', equipe, 'https://old.example/foto.png', base), 'https://old.example/foto.png', 'já gravada no atleta é preservada')
  for (const ruim of [
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://evil.example/foto.png',
    `https://evil.example/storage/v1/object/public/jogador-fotos-rosto/${caminhoFoto}`,
    `https://proj.supabase.co.evil.example/storage/v1/object/public/jogador-fotos-rosto/${caminhoFoto}`,
    `https://user:pw@proj.supabase.co/storage/v1/object/public/jogador-fotos-rosto/${caminhoFoto}`,
    `${base}/storage/v1/object/public/equipe-emblemas/${caminhoFoto}`,
    `${base}/storage/v1/object/public/jogador-fotos-rosto/atleta-foto-rosto/liga-7/equipe-2/${UUID}.png`,
    `${base}/storage/v1/object/public/jogador-fotos-rosto/atleta-foto-rosto/liga-8/equipe-1/${UUID}.png`,
    `${base}/storage/v1/object/public/jogador-fotos-rosto/atleta-foto-rosto/liga-7/equipe-1/../equipe-2/x.png`,
    `atleta-foto-rosto/liga-7/equipe-2/${UUID}.png`,
    `atleta-documento/liga-7/equipe-1/${UUID}.pdf`,
    'qualquer-nome.png',
    42,
    '',
  ]) {
    assert.equal(fotos.normalizarFotoRostoEntrada(ruim, equipe, null, base), null, String(ruim))
  }
  assert.equal(fotos.normalizarFotoRostoEntrada(urlFoto, equipe, null, undefined), null, 'sem URL do projeto configurada, nada passa')

  // Leitura: dono do caminho novo precisa ser a equipe e a liga do atleta.
  assert.equal(documentos.documentoPertenceAEquipe(proprio, equipe), true)
  assert.equal(documentos.documentoPertenceAEquipe(`atleta-documento/liga-7/equipe-2/${UUID}.pdf`, equipe), false)
  assert.equal(documentos.documentoPertenceAEquipe(`atleta-documento/liga-8/equipe-1/${UUID}.pdf`, equipe), false)
  assert.equal(documentos.documentoPertenceAEquipe(`atleta-foto-rosto/liga-7/equipe-1/${UUID}.png`, equipe), false)
  assert.equal(documentos.documentoPertenceAEquipe(legadoAlheio, equipe), true, 'legado não tem dono no nome')
  assert.equal(documentos.documentoParaLeitura(`${bucketUrl}public/atleta-arquivos/${proprio}`), proprio)
  assert.equal(documentos.documentoParaLeitura(proprio), proprio)
  assert.equal(documentos.documentoParaLeitura('https://evil.example/a.pdf'), null)

  console.log('uploads-tipos-novos: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
