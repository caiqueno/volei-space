// Checkout de ativação do campeonato — SIMULADO (sem gateway real).
// Recalcula preço/cupom sempre aqui, nunca aceita total vindo do cliente
// (mesma regra documentada em src/lib/pricing/index.ts).
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { error, success } from '@/lib/api-response'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { calculateChampionshipPrice, estimateMatchCount, resolveCoupon } from '@/lib/pricing'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, '*')
  if (liga instanceof Response) return liga

  const validation = await validateChampionshipSetup(ligaId)
  if (!validation.isValid) {
    return error('Configuração do campeonato ainda tem pendências — resolva-as antes de pagar.', 422, { errors: validation.errors })
  }

  const estimativaPartidas = estimateMatchCount({
    formato: liga.formato as string | null,
    quantidadeEquipes: liga.quantidadeEquipes as number | null,
    quantidadeGrupos: liga.quantidadeGrupos as number | null,
    turnoReturno: liga.turnoReturno as boolean | null,
    faseEliminatoria: liga.faseEliminatoria as string | null,
    disputaTerceiroLugar: liga.disputaTerceiroLugar as boolean | null,
  })
  const pricing = calculateChampionshipPrice({
    matchCount: estimativaPartidas.disponivel ? estimativaPartidas.total : 0,
    sumulaScoutsEnabled: liga.sumulaScoutsEnabled as boolean | null,
    qrCodeEnabled: liga.qrCodeEnabled as boolean | null,
  })

  const cupomParam = new URL(req.url).searchParams.get('cupom')
  const resolved = resolveCoupon(cupomParam)
  const discountCents = resolved ? Math.round(pricing.totalCents * resolved.percent) : 0
  const totalCents = pricing.totalCents - discountCents

  const referencia = randomUUID().slice(0, 8).toUpperCase()
  const pixPayload = `SIMULACAO-PIX|liga:${ligaId}|valor:${totalCents}|ref:${referencia}`

  return success({
    pricing,
    coupon: resolved ? { code: resolved.code, percent: resolved.percent, discountCents } : null,
    totalCents,
    pixPayload,
    jaConfirmado: liga.pagamentoConfirmadoEm != null,
  })
}
