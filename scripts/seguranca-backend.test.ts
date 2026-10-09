import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { jwtVerify } from 'jose'
import { adminEmailAllowed, ambienteExigeEmailDeAdmin, isAdminSession } from '../src/lib/admin-access'
import { emailsConferem, padraoIlikeLiteral } from '../src/lib/email-lookup'
import { fingerprintsMatch, passwordResetFingerprint, signPasswordResetToken, signToken } from '../src/lib/auth'
import { validateWebhookSignature, valoresDePagamentoConferem } from '../src/lib/infinitepay'
import { consumirCota, reiniciarCotas } from '../src/lib/rate-limit'

const envOriginal = {
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  INFINITEPAY_WEBHOOK_SECRET: process.env.INFINITEPAY_WEBHOOK_SECRET,
}

function restaurarAmbiente() {
  for (const [chave, valor] of Object.entries(envOriginal)) {
    if (valor == null) delete process.env[chave]
    else process.env[chave] = valor
  }
}

async function main() {
  process.env.JWT_SECRET = 'segredo-de-teste'
  process.env.ADMIN_EMAIL = 'admin@volei.space'
  process.env.NODE_ENV = 'production'
  delete process.env.VERCEL_ENV

  assert.equal(adminEmailAllowed('admin@volei.space'), true)
  assert.equal(adminEmailAllowed('outro@volei.space'), false)
  delete process.env.ADMIN_EMAIL
  assert.equal(ambienteExigeEmailDeAdmin(), true)
  assert.equal(adminEmailAllowed('admin@volei.space'), false)
  process.env.NODE_ENV = 'development'
  assert.equal(adminEmailAllowed('admin@volei.space'), true)
  process.env.VERCEL_ENV = 'preview'
  assert.equal(adminEmailAllowed('admin@volei.space'), false)
  delete process.env.VERCEL_ENV
  process.env.ADMIN_EMAIL = 'admin@volei.space'
  process.env.NODE_ENV = 'production'

  const sessao = await signToken({ adminId: 7, email: 'admin@volei.space', nome: 'Admin' })
  const payloadSessao = (await jwtVerify(sessao, new TextEncoder().encode(process.env.JWT_SECRET))).payload
  assert.equal(isAdminSession(payloadSessao), true)
  assert.equal(isAdminSession({ ...payloadSessao, purpose: 'password-reset' }), false)
  assert.equal(isAdminSession({ adminId: 7, email: 'admin@volei.space' }), false)
  assert.equal(isAdminSession({ scope: 'public-user', adminId: 7, email: 'admin@volei.space' }), false)

  const hash = '$2a$10$hash-de-teste-que-nao-pode-vazar'
  const reset = await signPasswordResetToken({ adminId: 7, email: 'admin@volei.space', senhaHash: hash })
  const payloadReset = (await jwtVerify(reset, new TextEncoder().encode(process.env.JWT_SECRET))).payload
  assert.equal(payloadReset.senhaHash, undefined)
  assert.equal(String(payloadReset.senhaFingerprint).includes(hash), false)
  assert.equal(isAdminSession(payloadReset), false)
  assert.equal(fingerprintsMatch(passwordResetFingerprint(hash), String(payloadReset.senhaFingerprint)), true)
  assert.equal(fingerprintsMatch('curto', String(payloadReset.senhaFingerprint)), false)

  assert.equal(padraoIlikeLiteral('time_a%@volei.space'), 'time\\_a\\%@volei.space')
  assert.equal(emailsConferem('a@volei.space', 'A@volei.space'), true)
  assert.equal(emailsConferem('a@volei.space', 'b@volei.space'), false)

  assert.equal(valoresDePagamentoConferem(49, 49), true)
  assert.equal(valoresDePagamentoConferem(49, 4900), true)
  assert.equal(valoresDePagamentoConferem(4900, 49), false)
  assert.equal(valoresDePagamentoConferem(49, 50), false)

  process.env.INFINITEPAY_WEBHOOK_SECRET = 'segredo-webhook'
  const corpo = '{"status":"paid"}'
  const assinatura = createHmac('sha256', 'segredo-webhook').update(corpo).digest('hex')
  assert.equal(validateWebhookSignature(corpo, assinatura), true)
  assert.equal(validateWebhookSignature(corpo, 'abc'), false)
  assert.equal(validateWebhookSignature(corpo, null), false)
  delete process.env.INFINITEPAY_WEBHOOK_SECRET
  assert.equal(validateWebhookSignature(corpo, null), false)
  process.env.NODE_ENV = 'development'
  assert.equal(validateWebhookSignature(corpo, null), true)
  process.env.VERCEL_ENV = 'preview'
  assert.equal(validateWebhookSignature(corpo, null), false)

  reiniciarCotas()
  assert.equal(consumirCota('login', 2, 1000, 1_000).permitido, true)
  assert.equal(consumirCota('login', 2, 1000, 1_000).permitido, true)
  assert.equal(consumirCota('login', 2, 1000, 1_000).permitido, false)
  assert.equal(consumirCota('login', 2, 1000, 2_001).permitido, true)
}

main().then(() => restaurarAmbiente()).catch((err) => {
  restaurarAmbiente()
  console.error(err)
  process.exit(1)
})
