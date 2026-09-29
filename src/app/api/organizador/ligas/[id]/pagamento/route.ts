// Checkout de ativação do campeonato — SIMULADO (sem gateway real).
// Recalcula preço/cupom sempre aqui, nunca aceita total vindo do cliente
// (mesma regra documentada em src/lib/pricing/index.ts).
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { error, success } from '@/lib/api-response'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { categoriesCheckoutGate, getCategoriesPricing } from '@/lib/category-pricing-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, '*')
  if (liga instanceof Response) return liga

  const jaConfirmado = liga.pagamentoConfirmadoEm != null
  if (!jaConfirmado) {
    const validation = await validateChampionshipSetup(ligaId)
    if (!validation.isValid) {
      return error('Configuração do campeonato ainda tem pendências — resolva-as antes de pagar.', 422, { errors: validation.errors })
    }
    const gate = await categoriesCheckoutGate(ligaId)
    if (!gate.ok) return error(gate.message, 422)
  }

  const cupomParam = new URL(req.url).searchParams.get('cupom')
  let pricing
  try {
    pricing = await getCategoriesPricing(ligaId, cupomParam)
  } catch {
    return error('Não foi possível calcular o preço das categorias.', 500)
  }
  if (!jaConfirmado && !pricing.available) return error('Conclua a estrutura de cada categoria para calcular o preço.', 422)

  const totalCents = pricing.totalCents
  const referencia = randomUUID().slice(0, 8).toUpperCase()
  const pixPayload = totalCents == null ? null : `SIMULACAO-PIX|liga:${ligaId}|valor:${totalCents}|ref:${referencia}`

  return success({
    pricing,
    coupon: pricing.coupon,
    totalCents,
    pixPayload,
    jaConfirmado,
  })
}
