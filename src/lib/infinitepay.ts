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

// Sem o segredo a assinatura não é conferida: a rota recusa o webhook.
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const webhookSecret = process.env.INFINITEPAY_WEBHOOK_SECRET
  if (!webhookSecret || !signature) return false

  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')
  const recebida = Buffer.from(signature)
  const calculada = Buffer.from(expected)
  if (recebida.length !== calculada.length) return false

  return timingSafeEqual(recebida, calculada)
}

export function parseExternalId(externalId: string): { tipo: 'equipe' | 'arbitro'; candidaturaId: string } | null {
  if (!externalId || externalId.length > 200) return null
  const partes = externalId.split(':')
  if (partes.length !== 2) return null
  const [tipo, candidaturaId] = partes
  if ((tipo !== 'equipe' && tipo !== 'arbitro') || !candidaturaId || candidaturaId.length > 80) return null
  return { tipo, candidaturaId }
}

export function pagamentoConfereExternalId(
  pagamento: { id: string; descricao?: string | null },
  externalId: string,
  candidatura: { id: string; pagamentoId?: string | null } | null,
) {
  const externo = parseExternalId(externalId)
  if (!externo || !candidatura || externo.candidaturaId !== candidatura.id) return false
  if (candidatura.pagamentoId && candidatura.pagamentoId === pagamento.id) return true
  return (pagamento.descricao ?? '') === externalId
}

export interface InfinitePayWebhookPayload {
  id: string
  external_id: string
  status: 'paid' | 'pending' | 'cancelled' | 'expired'
  amount: number
  paid_at?: string
}
