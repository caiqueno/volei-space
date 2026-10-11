import assert from 'node:assert/strict'
import { SignJWT } from 'jose'
import { gravarSessaoAcesso } from '../src/lib/acesso-arbitro-jogo'
import {
  classificarCookieGestao,
  clearTokenCookie,
  setTokenCookie,
  signPublicToken,
  signToken,
} from '../src/lib/auth'
import {
  INATIVIDADE_GESTAO_SEGUNDOS,
  caminhoIsentoDeInatividade,
  nomeDaSessao,
  saudacaoSessao,
  sessaoGestaoExpirada,
} from '../src/lib/sessao-gestao'
import { TOKEN_AUD, TOKEN_TYP } from '../src/lib/token-claims'
import { lerToken } from '../src/lib/token-verify'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-volei-space'

function testInatividade() {
  const agora = 1_700_000_000
  assert.equal(sessaoGestaoExpirada({ act: agora - INATIVIDADE_GESTAO_SEGUNDOS }, agora), true)
  assert.equal(sessaoGestaoExpirada({ act: agora - INATIVIDADE_GESTAO_SEGUNDOS + 1 }, agora), false)
  assert.equal(sessaoGestaoExpirada({ iat: agora - INATIVIDADE_GESTAO_SEGUNDOS - 1 }, agora), true)
  assert.equal(sessaoGestaoExpirada({ iat: agora - 60 }, agora), false)
  assert.equal(sessaoGestaoExpirada({}, agora), true)
  assert.equal(sessaoGestaoExpirada(null, agora), true)
}

function testSaudacao() {
  assert.equal(nomeDaSessao('  Ana  ', 'ana@volei.space'), 'Ana')
  assert.equal(nomeDaSessao('   ', 'ana@volei.space'), 'ana@volei.space')
  assert.equal(nomeDaSessao('', ''), '')
  assert.equal(saudacaoSessao('Ana', 'ana@volei.space'), 'Bem-vindo, Ana')
  assert.equal(saudacaoSessao('', 'ana@volei.space'), 'Bem-vindo, ana@volei.space')
  assert.equal(saudacaoSessao('', ''), '')
}

function testCaminhoDaMesa() {
  assert.equal(caminhoIsentoDeInatividade('/sumula/abc/lancar'), true)
  assert.equal(caminhoIsentoDeInatividade('/api/arbitro/partidas/abc/iniciar'), true)
  assert.equal(caminhoIsentoDeInatividade('/painel'), false)
  assert.equal(caminhoIsentoDeInatividade('/admin'), false)
}

function testCookieDeNavegador() {
  const navegador = setTokenCookie('token', 'navegador').options
  const persistente = setTokenCookie('token', 'persistente').options
  const limpar = clearTokenCookie().options
  assert.equal(navegador.maxAge, undefined)
  assert.equal('expires' in navegador, false)
  assert.equal(navegador.httpOnly, true)
  assert.equal(navegador.path, '/')
  assert.equal(persistente.maxAge, 60 * 60 * 8)
  assert.equal(limpar.maxAge, 0)
  assert.equal(limpar.httpOnly, navegador.httpOnly)
  assert.equal(limpar.sameSite, navegador.sameSite)
  assert.equal(limpar.path, navegador.path)
}

async function testExpiracaoDoToken() {
  const agora = Math.floor(Date.now() / 1000)
  const secreto = new TextEncoder().encode(process.env.JWT_SECRET)
  const inativo = await new SignJWT({
    scope: 'admin',
    typ: TOKEN_TYP.admin,
    adminId: 1,
    email: 'admin@volei.space',
    nome: 'Ana',
    act: agora - INATIVIDADE_GESTAO_SEGUNDOS - 5,
  })
    .setProtectedHeader({ alg: 'HS256', typ: TOKEN_TYP.admin })
    .setAudience(TOKEN_AUD.admin)
    .setIssuedAt(agora - INATIVIDADE_GESTAO_SEGUNDOS - 5)
    .setExpirationTime(agora + 3600)
    .sign(secreto)

  const lido = await lerToken<Record<string, unknown>>(inativo, 'admin')
  assert.ok(lido)
  assert.equal(sessaoGestaoExpirada(lido, agora), true)
  assert.equal(classificarCookieGestao(inativo, agora), 'expirada')

  const morto = await new SignJWT({
    scope: 'admin',
    typ: TOKEN_TYP.admin,
    adminId: 1,
    email: 'admin@volei.space',
    nome: 'Ana',
    act: agora - 10,
  })
    .setProtectedHeader({ alg: 'HS256', typ: TOKEN_TYP.admin })
    .setAudience(TOKEN_AUD.admin)
    .setIssuedAt(agora - 30)
    .setExpirationTime(agora - 10)
    .sign(secreto)
  assert.equal(await lerToken(morto, 'admin'), null)
  assert.equal(classificarCookieGestao(morto, agora), 'expirada')

  const admin = await signToken({ adminId: 1, email: 'admin@volei.space', nome: 'Ana' })
  const payloadAdmin = await lerToken<Record<string, unknown>>(admin, 'admin')
  assert.ok(payloadAdmin)
  const vidaAdmin = Number(payloadAdmin.exp) - Number(payloadAdmin.iat)
  assert.ok(vidaAdmin >= INATIVIDADE_GESTAO_SEGUNDOS - 2 && vidaAdmin <= INATIVIDADE_GESTAO_SEGUNDOS + 2)
  assert.equal(sessaoGestaoExpirada(payloadAdmin, agora), false)
  assert.equal(classificarCookieGestao(admin, agora), 'valida')

  const organizador = await signPublicToken({
    userId: 'org-1',
    email: 'org@volei.space',
    nome: '',
    tipo: 'organizador',
    status: 'ATIVA',
  })
  const payloadOrganizador = await lerToken<Record<string, unknown>>(organizador, 'public')
  assert.ok(payloadOrganizador)
  assert.equal(typeof payloadOrganizador.act, 'number')
  const vidaOrganizador = Number(payloadOrganizador.exp) - Number(payloadOrganizador.iat)
  assert.ok(vidaOrganizador >= 8 * 60 * 60 - 2 && vidaOrganizador <= 8 * 60 * 60 + 2)
  assert.equal(classificarCookieGestao(organizador, agora + INATIVIDADE_GESTAO_SEGUNDOS + 5), 'expirada')
  assert.equal(classificarCookieGestao(organizador, agora + 30), 'valida')

  const publico = await signPublicToken({
    userId: 'pub-1',
    email: 'pub@volei.space',
    nome: 'Público',
    tipo: 'publico',
    status: 'ATIVA',
  })
  assert.equal(classificarCookieGestao(publico, agora), 'outra')
  const payloadPublico = await lerToken<Record<string, unknown>>(publico, 'public')
  assert.equal(payloadPublico?.act, undefined)
}

async function testLinkDoArbitro() {
  const acesso = await gravarSessaoAcesso({ id: 'acesso-1', partidaId: 10, token: 'token-da-mesa' })
  assert.equal(acesso.options.maxAge, 60 * 60 * 8)
  assert.equal(acesso.name, 'luva_acesso_arbitro')
}

async function main() {
  testInatividade()
  testSaudacao()
  testCaminhoDaMesa()
  testCookieDeNavegador()
  await testExpiracaoDoToken()
  await testLinkDoArbitro()
  console.log('sessao-gestao ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
