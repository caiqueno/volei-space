import assert from 'node:assert/strict'
import fs from 'node:fs'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'
import { criarBanco } from './helpers/fake-supabase'
import { gravarPagamentoSimulado } from '../src/lib/pagamento-simulado'
import { validateWebhookSignature } from '../src/lib/infinitepay'

async function testeOrigemSimulado() {
  const ligas = [{ id: 7, pagamentoConfirmadoEm: null }, { id: 8, pagamentoConfirmadoEm: null }]
  const banco = criarBanco({ Liga: ligas })
  const quando = '2026-10-16T12:00:00.000Z'
  const { error } = await gravarPagamentoSimulado(banco, 7, quando)
  assert.equal(error, null)
  assert.deepEqual(ligas[0], { id: 7, pagamentoConfirmadoEm: quando, pagamentoOrigem: 'simulado' })
  assert.equal(ligas[1].pagamentoConfirmadoEm, null, 'outro campeonato intacto')
}

async function testeColunaAusente() {
  const ligas = [{ id: 7, pagamentoConfirmadoEm: null }]
  const banco = criarBanco({ Liga: ligas }, { colunasAusentes: { Liga: ['pagamentoOrigem'] } })
  const aviso = console.warn
  console.warn = () => {}
  try {
    const { error } = await gravarPagamentoSimulado(banco, 7, '2026-10-16T12:00:00.000Z')
    assert.equal(error, null, 'tolera coluna ausente')
  } finally {
    console.warn = aviso
  }
  assert.equal(ligas[0].pagamentoConfirmadoEm, '2026-10-16T12:00:00.000Z')
  assert.equal('pagamentoOrigem' in ligas[0], false)

  // Outro erro de banco não é engolido.
  const semTabela = criarBanco({})
  const { error } = await gravarPagamentoSimulado(semTabela, 7, '2026-10-16T12:00:00.000Z')
  assert.ok(error)
}

async function testeWebhookLegado() {
  const { POST } = await import('../src/app/api/webhooks/infinitepay/route')
  const corpo = JSON.stringify({ id: 'p1', external_id: 'equipe:abc12345', status: 'paid', amount: 100 })
  const segredo = 'segredo-webhook-teste'
  process.env.INFINITEPAY_WEBHOOK_SECRET = segredo
  const valida = createHmac('sha256', segredo).update(corpo).digest('hex')
  for (const assinatura of [valida, 'a'.repeat(64), 'curta', undefined]) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (assinatura) headers['x-infinitepay-signature'] = assinatura
    const res = await POST(new NextRequest('http://127.0.0.1:3001/api/webhooks/infinitepay', { method: 'POST', headers, body: corpo }))
    assert.equal(res.status, 410)
    assert.match((await res.json() as { error: string }).error, /desativado/i)
  }
  const fonte = fs.readFileSync('src/app/api/webhooks/infinitepay/route.ts', 'utf8')
  assert.doesNotMatch(fonte, /supabase|sendEmail/i, 'a rota legada não toca em banco nem e-mail')
}

function testeAssinatura() {
  const anterior = { secret: process.env.INFINITEPAY_WEBHOOK_SECRET, node: process.env.NODE_ENV }
  process.env.INFINITEPAY_WEBHOOK_SECRET = 'segredo-webhook-teste'
  const corpo = '{"id":"p1"}'
  const valida = createHmac('sha256', 'segredo-webhook-teste').update(corpo).digest('hex')
  assert.equal(validateWebhookSignature(corpo, valida), true)
  assert.equal(validateWebhookSignature(corpo, valida.toUpperCase()), true)
  // Tamanhos e formatos diferentes devolvem false sem lançar.
  for (const ruim of ['', 'a', valida.slice(1), `${valida}00`, 'z'.repeat(64), `${valida.slice(0, 63)}é`]) {
    assert.doesNotThrow(() => validateWebhookSignature(corpo, ruim))
    assert.equal(validateWebhookSignature(corpo, ruim), false, ruim)
  }
  assert.equal(validateWebhookSignature(corpo, 'f'.repeat(64)), false)
  process.env.INFINITEPAY_WEBHOOK_SECRET = anterior.secret ?? ''
  if (anterior.secret === undefined) delete process.env.INFINITEPAY_WEBHOOK_SECRET
}

async function main() {
  await testeOrigemSimulado()
  await testeColunaAusente()
  await testeWebhookLegado()
  testeAssinatura()
  console.log('pagamento-simulado: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
