import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { adminEmailAllowed, isAdminSession } from '../src/lib/admin-access'
import { validateWebhookSignature, parseExternalId, pagamentoConfereExternalId } from '../src/lib/infinitepay'
import { fingerprintSenha, fingerprintsConferem } from '../src/lib/password-fingerprint'
import { consumirLimite, limparLimites } from '../src/lib/rate-limit'
import { assinarToken, lerToken } from '../src/lib/token-verify'
import { TOKEN_AUD, TOKEN_TYP } from '../src/lib/token-claims'
import { clearTokenCookie, tokenCookieOptions } from '../src/lib/auth'
import { mascararCpf, mascararLeituraInscricao, mascararNascimento } from '../src/lib/team-registration-draft'
import { camposEditaveisDaPartida, equipesConferemComLiga } from '../src/lib/partida-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-volei-space'

function testAdminFailClosed() {
  const anterior = process.env.ADMIN_EMAIL
  delete process.env.ADMIN_EMAIL
  assert.equal(adminEmailAllowed('admin@volei.space'), false)
  assert.equal(isAdminSession({ adminId: 1, email: 'admin@volei.space', typ: TOKEN_TYP.admin, aud: TOKEN_AUD.admin }), false)
  process.env.ADMIN_EMAIL = 'admin@volei.space'
  assert.equal(adminEmailAllowed(' Admin@Volei.Space '), true)
  assert.equal(adminEmailAllowed('outro@volei.space'), false)
  assert.equal(isAdminSession({ adminId: 1, email: 'admin@volei.space', typ: TOKEN_TYP.admin, aud: TOKEN_AUD.admin }), true)
  assert.equal(isAdminSession({ adminId: 1, email: 'admin@volei.space', typ: TOKEN_TYP.reset, aud: TOKEN_AUD.reset, purpose: 'password-reset' }), false)
  if (anterior === undefined) delete process.env.ADMIN_EMAIL
  else process.env.ADMIN_EMAIL = anterior
}

function testWebhookSignature() {
  const anterior = process.env.INFINITEPAY_WEBHOOK_SECRET
  delete process.env.INFINITEPAY_WEBHOOK_SECRET
  assert.equal(validateWebhookSignature('{}', 'a'.repeat(64)), false)
  process.env.INFINITEPAY_WEBHOOK_SECRET = 'segredo-webhook'
  const corpo = '{"id":"pay_1"}'
  const assinatura = createHmac('sha256', 'segredo-webhook').update(corpo).digest('hex')
  assert.equal(validateWebhookSignature(corpo, assinatura), true)
  assert.equal(validateWebhookSignature(corpo, 'curta'), false)
  assert.equal(validateWebhookSignature(corpo, null), false)
  assert.equal(validateWebhookSignature(corpo, `${assinatura}aa`), false)
  if (anterior === undefined) delete process.env.INFINITEPAY_WEBHOOK_SECRET
  else process.env.INFINITEPAY_WEBHOOK_SECRET = anterior
}

function testExternalId() {
  assert.deepEqual(parseExternalId('equipe:cand-1'), { tipo: 'equipe', candidaturaId: 'cand-1' })
  assert.equal(parseExternalId('outro:cand-1'), null)
  assert.equal(parseExternalId('equipe:cand-1:extra'), null)
  assert.equal(pagamentoConfereExternalId({ id: 'pag-1', descricao: 'Taxa' }, 'equipe:cand-1', { id: 'cand-1', pagamentoId: 'pag-1' }), true)
  assert.equal(pagamentoConfereExternalId({ id: 'pag-1', descricao: 'Taxa' }, 'equipe:cand-2', { id: 'cand-1', pagamentoId: 'pag-1' }), false)
  assert.equal(pagamentoConfereExternalId({ id: 'pag-1', descricao: 'arbitro:arb-1' }, 'arbitro:arb-1', { id: 'arb-1', pagamentoId: null }), true)
  assert.equal(pagamentoConfereExternalId({ id: 'pag-1', descricao: 'Taxa' }, 'arbitro:arb-1', { id: 'arb-1', pagamentoId: null }), false)
}

function testFingerprint() {
  const hash = '$2a$10$abcdefghijklmnopqrstuv'
  const fp = fingerprintSenha(hash)
  assert.notEqual(fp, hash)
  assert.equal(fp.includes('abcdefghijklmnopqrstuv'), false)
  assert.equal(fingerprintsConferem(fp, fingerprintSenha(hash)), true)
  assert.equal(fingerprintsConferem(fp, fingerprintSenha(`${hash}x`)), false)
  assert.equal(fingerprintsConferem(fp, 'curto'), false)
}

async function testTokenAudiences() {
  const admin = await assinarToken({ adminId: 1, email: 'admin@volei.space', nome: 'Admin' }, 'admin', '8h')
  const publico = await assinarToken({ userId: 'u1', email: 'a@b.c', nome: 'A', tipo: 'organizador', status: 'ATIVA', scope: 'public-user' }, 'public', '8h')
  const reset = await assinarToken({ purpose: 'password-reset', adminId: 1, email: 'admin@volei.space', senhaFingerprint: 'abc' }, 'reset', '30m')
  const ativacao = await assinarToken({ purpose: 'account-activation', candidaturaId: 'c1', email: 'a@b.c' }, 'activation', '24h')
  assert.ok(await lerToken(admin, 'admin'))
  assert.equal(await lerToken(admin, 'public'), null)
  assert.equal(await lerToken(reset, 'admin'), null)
  assert.equal(await lerToken(publico, 'admin'), null)
  assert.equal(await lerToken(ativacao, 'public'), null)
  assert.ok(await lerToken(reset, 'reset'))
  assert.ok(await lerToken(ativacao, 'activation'))
  const bruto = JSON.parse(Buffer.from(reset.split('.')[1], 'base64url').toString())
  assert.equal(bruto.senhaHash, undefined)
  assert.equal(bruto.aud, TOKEN_AUD.reset)
  assert.equal(bruto.typ, TOKEN_TYP.reset)
}

function testRateLimit() {
  limparLimites()
  assert.equal(consumirLimite('login:teste', 2, 60_000, 1_000).ok, true)
  assert.equal(consumirLimite('login:teste', 2, 60_000, 1_001).ok, true)
  assert.equal(consumirLimite('login:teste', 2, 60_000, 1_002).ok, false)
  assert.equal(consumirLimite('login:teste', 2, 60_000, 61_001).ok, true)
  limparLimites()
}

function testCookieLogout() {
  const emitir = tokenCookieOptions(60 * 60 * 8)
  const limpar = clearTokenCookie().options
  assert.equal(limpar.httpOnly, emitir.httpOnly)
  assert.equal(limpar.secure, emitir.secure)
  assert.equal(limpar.sameSite, emitir.sameSite)
  assert.equal(limpar.path, emitir.path)
  assert.equal(limpar.maxAge, 0)
}

function testMascaraEPartida() {
  assert.equal(mascararCpf('123.456.789-01'), '***.***.***-01')
  assert.equal(mascararCpf(null), null)
  assert.equal(mascararNascimento('1990-01-02'), '****-**-**')
  const leitura = mascararLeituraInscricao({ players: [{ id: 1, nome: 'Ana', numero: 7, posicao: 'LV', fotoUrl: null, cpf: '12345678901', dataNascimento: '1990-01-02T00:00:00.000Z', documentoTipo: 'RG', documentoNumero: '1' }] })
  assert.equal(leitura.players[0].cpf, '***.***.***-01')
  assert.equal(leitura.players[0].dataNascimento, '****-**-**')
  assert.equal(leitura.players[0].documentoNumero, '1')
  assert.deepEqual(camposEditaveisDaPartida({ ligaId: 1, serie: 'OURO', sumulaToken: 'segredo', localNome: 'Quadra' }), { ligaId: 1, localNome: 'Quadra' })
  assert.equal(equipesConferemComLiga(4, [10, 11], [{ id: 10, ligaId: 4 }, { id: 11, ligaId: 4 }]), true)
  assert.equal(equipesConferemComLiga(4, [10, 11], [{ id: 10, ligaId: 4 }, { id: 11, ligaId: 9 }]), false)
  assert.equal(equipesConferemComLiga(4, [10, 10], [{ id: 10, ligaId: 4 }]), false)
}

async function main() {
  testAdminFailClosed()
  testWebhookSignature()
  testExternalId()
  testFingerprint()
  await testTokenAudiences()
  testRateLimit()
  testCookieLogout()
  testMascaraEPartida()
  console.log('auth-security ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
