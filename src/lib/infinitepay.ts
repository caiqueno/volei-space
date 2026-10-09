// InfinitePay payment integration.
// Docs: https://developers.infinitepay.io
import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'

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

// Assinatura obrigatória em qualquer ambiente. Sem o segredo, o webhook é recusado.
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const webhookSecret = process.env.INFINITEPAY_WEBHOOK_SECRET
  if (!webhookSecret || !signature) return false

  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')
  const received = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (received.length !== expectedBuffer.length) return false

  try {
    return timingSafeEqual(received, expectedBuffer)
  } catch {
    return false
  }
}

// InfinitePay pode enviar o valor em reais ou em centavos.
export function paymentAmountsMatch(expected: number, received: number) {
  if (!Number.isFinite(expected) || !Number.isFinite(received) || expected < 0 || received < 0) return false
  if (Math.abs(expected - received) < 0.009) return true
  return Math.abs(Math.round(expected * 100) - received) < 0.009
}

export const infinitePayWebhookSchema = z.object({
  id: z.string().trim().min(1).max(120),
  external_id: z.string().trim().regex(/^(equipe|arbitro):([a-z0-9-]{8,64})$/i),
  status: z.enum(['paid', 'pending', 'cancelled', 'expired']),
  amount: z.coerce.number().finite().nonnegative(),
  paid_at: z.string().trim().min(1).max(40).optional(),
})

export type InfinitePayWebhookPayload = z.infer<typeof infinitePayWebhookSchema>
