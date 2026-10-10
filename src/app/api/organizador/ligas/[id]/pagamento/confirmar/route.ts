// Confirma o pagamento SIMULADO da ativação. Não há gateway neste caminho.
// Fica fechado por padrão: só um administrador confirma, ou o organizador
// quando ALLOW_SIMULATED_PAYMENT_CONFIRMATION=true.
import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole, verifyToken } from '@/lib/auth'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { categoriesCheckoutGate } from '@/lib/category-pricing-server'

function confirmacaoSimuladaLiberada() {
  const valor = process.env.ALLOW_SIMULATED_PAYMENT_CONFIRMATION?.trim().toLowerCase()
  return valor === '1' || valor === 'true'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const admin = await verifyToken(req)
  let pagamentoConfirmadoEmAtual: string | null = null

  if (admin) {
    const { data, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,pagamentoConfirmadoEm')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr) {
      console.error('[pagamento/confirmar] erro ao ler campeonato', ligaErr)
      return error('Não foi possível liberar a configuração.', 500)
    }
    if (!data) return error('Campeonato não encontrado.', 404)
    pagamentoConfirmadoEmAtual = data.pagamentoConfirmadoEm
  } else if (confirmacaoSimuladaLiberada()) {
    const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,pagamentoConfirmadoEm')
    if (liga instanceof Response) return liga
    pagamentoConfirmadoEmAtual = (liga.pagamentoConfirmadoEm as string | null) ?? null
  } else {
    const organizador = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (organizador instanceof Response) return organizador
    return error('A confirmação de pagamento sem gateway está desativada.', 403)
  }

  if (pagamentoConfirmadoEmAtual) return success({ pagamentoConfirmadoEm: pagamentoConfirmadoEmAtual })
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  const gate = await categoriesCheckoutGate(ligaId)
  if (!gate.ok) return error(gate.message, 422)

  const validation = await validateChampionshipSetup(ligaId)
  if (!validation.isValid) {
    return error('Configuração do campeonato ainda tem pendências — resolva-as antes de continuar.', 422, { errors: validation.errors })
  }

  const pagamentoConfirmadoEm = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('Liga')
    .update({ pagamentoConfirmadoEm })
    .eq('id', ligaId)

  if (updateErr) {
    console.error('[pagamento/confirmar] erro ao gravar', updateErr)
    return error('Não foi possível liberar a configuração.', 500)
  }

  return success({ pagamentoConfirmadoEm })
}
