// InfinitePay payment integration.
// Docs: https://developers.infinitepay.io
import { createHmac, timingSafeEqual } from 'crypto'

const INFINITEPAY_API_URL = 'https://api.infinitepay.io/v2'

interface CreatePaymentLinkParams {
  amount: number
  description: string
  externalId: string
  customerName: string
  customerEmail: string
  expiresInDays?: number
}

interface InfinitePayLinkResponse {
  id: string
  url: string
  status: string
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<InfinitePayLinkResponse> {
  const apiKey = process.env.INFINITEPAY_API_KEY
  if (!apiKey) throw new Error('INFINITEPAY_API_KEY not set')

  const res = await fetch(`${INFINITEPAY_API_URL}/payment_links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      description: params.description,
      external_id: params.externalId,
      customer: {
        name: params.customerName,
        email: params.customerEmail,
      },
      expires_in_days: params.expiresInDays ?? 7,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`InfinitePay error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return {
    id: data.id,
    url: data.url ?? data.payment_url,
    status: data.status,
  }
}

// The exact implementation depends on InfinitePay's webhook signing method.
// Keep the signature check permissive in development, but strict in production.
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const webhookSecret = process.env.INFINITEPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.warn('INFINITEPAY_WEBHOOK_SECRET not set - skipping signature validation in dev')
    return process.env.NODE_ENV !== 'production'
  }
  if (!signature) return false

  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  )
}

export interface InfinitePayWebhookPayload {
  id: string
  external_id: string
  status: 'paid' | 'pending' | 'cancelled' | 'expired'
  amount: number
  paid_at?: string
}
