// Confirma o pagamento SIMULADO da ativação — chamado pelo botão "Já paguei"
// da tela de Pix fake. Não há gateway real nem webhook por trás disto.
import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { validateChampionshipSetup } from '@/lib/championship-setup-engine'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { categoriesCheckoutGate } from '@/lib/category-pricing-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,pagamentoConfirmadoEm')
  if (liga instanceof Response) return liga
  if (liga.pagamentoConfirmadoEm) return success({ pagamentoConfirmadoEm: liga.pagamentoConfirmadoEm })
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

  if (updateErr) return error('Não foi possível liberar a configuração.', 500, updateErr)

  return success({ pagamentoConfirmadoEm })
}
