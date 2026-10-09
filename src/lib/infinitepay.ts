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

function desenvolvimentoLocal() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV
}

// Sem segredo, só o `next dev` local segue sem assinatura. Preview da Vercel
// tem NODE_ENV=production e VERCEL_ENV=preview; os dois casos recusam.
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const webhookSecret = process.env.INFINITEPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    if (desenvolvimentoLocal()) {
      console.warn('INFINITEPAY_WEBHOOK_SECRET ausente — assinatura ignorada só no desenvolvimento local')
      return true
    }
    console.error('INFINITEPAY_WEBHOOK_SECRET ausente — webhook recusado')
    return false
  }
  if (!signature) return false

  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  try {
    const recebida = Buffer.from(signature)
    const esperada = Buffer.from(expected)
    if (recebida.length !== esperada.length) return false
    return timingSafeEqual(recebida, esperada)
  } catch (err) {
    console.error('[infinitepay] falha ao comparar assinatura', err)
    return false
  }
}

// O valor gravado pode estar em reais e o webhook em centavos, ou o contrário.
export function valoresDePagamentoConferem(esperado: number, recebido: number) {
  if (!Number.isFinite(esperado) || !Number.isFinite(recebido)) return false
  if (esperado < 0 || recebido < 0) return false
  const mesmoValor = Math.abs(esperado - recebido) < 0.009
  const recebidoEmCentavos = Math.abs(Math.round(esperado * 100) - recebido) < 0.009
  const esperadoEmCentavos = Math.abs(Math.round(recebido * 100) - esperado) < 0.009
  return mesmoValor || recebidoEmCentavos || esperadoEmCentavos
}

export interface InfinitePayWebhookPayload {
  id: string
  external_id: string
  status: 'paid' | 'pending' | 'cancelled' | 'expired'
  amount: number
  paid_at?: string
}
