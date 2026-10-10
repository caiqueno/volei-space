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

function desenvolvimentoLocal() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV
}

// Sem segredo, só o `next dev` local segue sem assinatura. Produção e preview
// da Vercel recusam. Tamanhos diferentes não estouram o timingSafeEqual.
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
  const received = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (received.length !== expectedBuffer.length) return false

  try {
    return timingSafeEqual(received, expectedBuffer)
  } catch (err) {
    console.error('[infinitepay] falha ao comparar assinatura', err)
    return false
  }
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

// O webhook pode mandar centavos do valor gravado em reais. O caminho inverso
// (valor gravado em centavos e evento em reais) fica de fora: R$ 100 e R$ 1
// passariam a conferir.
export function paymentAmountsMatch(expected: number, received: number) {
  if (!Number.isFinite(expected) || !Number.isFinite(received) || expected < 0 || received < 0) return false
  if (Math.abs(expected - received) < 0.009) return true
  return Math.abs(Math.round(expected * 100) - received) < 0.009
}

export function valoresDePagamentoConferem(esperado: number, recebido: number) {
  return paymentAmountsMatch(esperado, recebido)
}

export const infinitePayWebhookSchema = z.object({
  id: z.string().trim().min(1).max(120),
  external_id: z.string().trim().regex(/^(equipe|arbitro):([a-z0-9-]{8,64})$/i),
  status: z.enum(['paid', 'pending', 'cancelled', 'expired']),
  amount: z.coerce.number().finite().nonnegative(),
  paid_at: z.string().trim().min(1).max(40).optional(),
})

export type InfinitePayWebhookPayload = z.infer<typeof infinitePayWebhookSchema>
