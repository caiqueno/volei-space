import { NextResponse } from 'next/server'

// Webhook legado da LUVA, desligado (decisão D4 da Fase 0): hoje não existe
// cobrança real. A ativação do campeonato usa a confirmação simulada, marcada
// com Liga.pagamentoOrigem = 'simulado'. A rota responde 410 a qualquer evento,
// sem ler o corpo, sem tocar no banco e sem enviar e-mail. A assinatura em
// src/lib/infinitepay.ts fica pronta para quando o gateway real voltar.
export const dynamic = 'force-dynamic'

const resposta = () =>
  NextResponse.json(
    { error: 'Webhook de pagamento desativado.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )

export async function POST(_req?: Request) {
  return resposta()
}
