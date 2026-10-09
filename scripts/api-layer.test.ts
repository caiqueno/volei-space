import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { infinitePayWebhookSchema, paymentAmountsMatch, validateWebhookSignature } from '../src/lib/infinitepay'
import { createRateLimiter } from '../src/lib/auth-rate-limit'
import { idInteiroPositivoSchema, mensagemAprovacaoSchema, partidaAtualizacaoSchema, partidaSchema } from '../src/lib/schemas'

const segredoAnterior = process.env.INFINITEPAY_WEBHOOK_SECRET
const payload = '{"id":"pay_1"}'
const segredo = 'segredo-de-teste'
const assinatura = createHmac('sha256', segredo).update(payload).digest('hex')

delete process.env.INFINITEPAY_WEBHOOK_SECRET
assert.equal(validateWebhookSignature(payload, assinatura), false)

process.env.INFINITEPAY_WEBHOOK_SECRET = segredo
assert.equal(validateWebhookSignature(payload, null), false)
assert.equal(validateWebhookSignature(payload, 'curta'), false)
assert.equal(validateWebhookSignature(payload, assinatura), true)
const trocada = assinatura.slice(0, -1) + (assinatura.endsWith('a') ? 'b' : 'a')
assert.equal(trocada.length, assinatura.length)
assert.equal(validateWebhookSignature(payload, trocada), false)

if (segredoAnterior === undefined) delete process.env.INFINITEPAY_WEBHOOK_SECRET
else process.env.INFINITEPAY_WEBHOOK_SECRET = segredoAnterior

assert.equal(paymentAmountsMatch(10, 10), true)
assert.equal(paymentAmountsMatch(10.5, 1050), true)
assert.equal(paymentAmountsMatch(100, 1), false)
assert.equal(paymentAmountsMatch(Number.NaN, 10), false)

const partida = { ligaId: 1, equipeAId: 2, equipeBId: 2, categoria: 'MISTO' as const, rodada: 1 }
assert.equal(partidaSchema.safeParse(partida).success, false)
assert.equal(partidaSchema.safeParse({ ...partida, equipeBId: 3 }).success, true)
assert.equal(partidaAtualizacaoSchema.safeParse({ equipeAId: 4, equipeBId: 4 }).success, false)
assert.equal(partidaAtualizacaoSchema.safeParse({ equipeAId: 4 }).success, true)

assert.equal(idInteiroPositivoSchema.safeParse('').success, false)
assert.equal(idInteiroPositivoSchema.safeParse('abc').success, false)
assert.equal(idInteiroPositivoSchema.safeParse('1.5').success, false)
assert.equal(idInteiroPositivoSchema.safeParse('12').success, true)

assert.equal(mensagemAprovacaoSchema.safeParse({ aprovada: true }).success, true)
assert.equal(mensagemAprovacaoSchema.safeParse({ aprovada: 'sim' }).success, false)
assert.equal(mensagemAprovacaoSchema.safeParse({ aprovada: true, texto: 'x' }).success, false)

const webhook = infinitePayWebhookSchema.safeParse({
  id: 'pay_1',
  external_id: 'equipe:ckxyz1234567890',
  status: 'paid',
  amount: '1500',
})
assert.equal(webhook.success, true)
if (webhook.success) assert.equal(webhook.data.amount, 1500)
assert.equal(infinitePayWebhookSchema.safeParse({
  id: 'pay_1',
  external_id: 'liga:ckxyz1234567890',
  status: 'paid',
  amount: 10,
}).success, false)

const limiter = createRateLimiter({ limit: 2, windowMs: 1000 })
assert.equal(limiter.permitir('ip', 0), true)
assert.equal(limiter.permitir('ip', 10), true)
assert.equal(limiter.permitir('ip', 20), false)
assert.equal(limiter.permitir('ip', 1001), true)
assert.equal(limiter.permitir('outro', 20), true)

console.log('api-layer ok')
