import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { GET as listarCandidaturas } from '../src/app/api/admin/candidaturas/route'
import { POST as aprovarCandidatura } from '../src/app/api/admin/candidaturas/[id]/aprovar/route'
import { POST as rejeitarCandidatura } from '../src/app/api/admin/candidaturas/[id]/rejeitar/route'
import { POST as reenviarCandidatura } from '../src/app/api/admin/candidaturas/[id]/reenviar/route'
import { GET as listarOrganizadores, PATCH as atualizarOrganizador, POST as criarOrganizador } from '../src/app/api/admin/organizadores/route'
import { GET as listarCodigos, POST as criarCodigo } from '../src/app/api/admin/codigos-acesso/route'
import { GET as painelSimulacao, POST as acaoSimulacao } from '../src/app/api/admin/simulacoes/route'
import { POST as aprovarPartida } from '../src/app/api/admin/partidas-candidaturas/[id]/aprovar/route'

process.env.JWT_SECRET ||= 'teste-local-jwt-secret-32-chars-min'
process.env.NODE_ENV = 'development'

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => Promise<NextResponse>

function assinar(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

async function postWebhook(raw: string, signature: string | null) {
  const { POST } = await import('../src/app/api/webhooks/infinitepay/route')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== null) headers['x-infinitepay-signature'] = signature
  const resposta = await POST(new NextRequest('http://127.0.0.1:3001/api/webhooks/infinitepay', {
    method: 'POST',
    headers,
    body: raw,
  }))
  return { status: resposta.status, json: await resposta.json() }
}

async function negar(method: string, carregar: () => Handler, url: string) {
  const handler = carregar()
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'content-type': 'application/json' },
  }
  if (method !== 'GET') init.body = '{}'
  const resposta = await handler(new NextRequest(`http://127.0.0.1:3001${url}`, init), {
    params: Promise.resolve({ id: 'inexistente' }),
  })
  assert.equal(resposta.status, 401, `${method} ${url}`)
  const json = await resposta.json() as { error?: string }
  assert.match(json.error ?? '', /autorizado/i, `${method} ${url}`)
}

async function main() {
  const segredo = 'teste-local-infinitepay-webhook'
  const pago = JSON.stringify({
    id: 'fake-pagamento-001',
    external_id: 'equipe:candidatura-inexistente',
    status: 'paid',
    amount: 25000,
    paid_at: '2026-06-07T10:00:00Z',
  })
  const pendente = JSON.stringify({
    id: 'fake-pagamento-002',
    external_id: 'equipe:candidatura-inexistente',
    status: 'pending',
    amount: 25000,
  })

  // Webhook legado desligado (D4): 410 para qualquer evento, com ou sem assinatura.
  process.env.INFINITEPAY_WEBHOOK_SECRET = segredo
  for (const ambiente of ['production', 'development']) {
    process.env.NODE_ENV = ambiente
    for (const [raw, assinatura] of [[pago, assinar(pago, segredo)], [pago, null], [pago, 'a'.repeat(64)], [pendente, assinar(pendente, segredo)]] as const) {
      const resposta = await postWebhook(raw, assinatura)
      assert.equal(resposta.status, 410, ambiente)
      assert.match(resposta.json.error, /desativado/i)
    }
  }

  const { validateWebhookSignature } = await import('../src/lib/infinitepay')
  process.env.INFINITEPAY_WEBHOOK_SECRET = segredo
  assert.equal(validateWebhookSignature(pago, assinar(pago, segredo)), true)
  assert.equal(validateWebhookSignature(pago, null), false)
  assert.equal(validateWebhookSignature(pago, 'b'.repeat(64)), false)

  process.env.NODE_ENV = 'development'
  await negar('GET', () => listarCandidaturas, '/api/admin/candidaturas')
  await negar('POST', () => aprovarCandidatura, '/api/admin/candidaturas/inexistente/aprovar')
  await negar('POST', () => rejeitarCandidatura, '/api/admin/candidaturas/inexistente/rejeitar')
  await negar('POST', () => reenviarCandidatura, '/api/admin/candidaturas/inexistente/reenviar')
  await negar('GET', () => listarOrganizadores, '/api/admin/organizadores')
  await negar('POST', () => criarOrganizador, '/api/admin/organizadores')
  await negar('PATCH', () => atualizarOrganizador, '/api/admin/organizadores')
  await negar('GET', () => listarCodigos, '/api/admin/codigos-acesso')
  await negar('POST', () => criarCodigo, '/api/admin/codigos-acesso')
  await negar('GET', () => painelSimulacao, '/api/admin/simulacoes')
  await negar('POST', () => acaoSimulacao, '/api/admin/simulacoes')
  await negar('POST', () => aprovarPartida, '/api/admin/partidas-candidaturas/inexistente/aprovar')

  console.log('api-contrato ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
