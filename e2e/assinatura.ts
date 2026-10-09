import { createHmac } from 'node:crypto'
import { WEBHOOK_SECRET } from './env'

export function assinarCorpo(body: string, secret = WEBHOOK_SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function webhookPago(candidaturaId = 'candidatura-inexistente') {
  return {
    id: 'fake-pagamento-001',
    external_id: `equipe:${candidaturaId}`,
    status: 'paid' as const,
    amount: 25000,
    paid_at: '2026-06-07T10:00:00Z',
  }
}
