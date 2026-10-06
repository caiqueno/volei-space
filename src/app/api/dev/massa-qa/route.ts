import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { auditarMassa, criarCopaMassa, preencherEquipesVazias } from '@/lib/massa-qa'
import { alvoSupabase, ambienteProducao } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function bloqueado() {
  return ambienteProducao || alvoSupabase !== 'desenvolvimento'
}

export async function GET(req: NextRequest) {
  if (bloqueado() || req.headers.get('x-massa-local') !== 'qa') return error('Indisponível.', 404)
  try {
    return success(await auditarMassa())
  } catch (falha) {
    return error('Não foi possível auditar a massa.', 500, falha instanceof Error ? falha.message : String(falha))
  }
}

export async function POST(req: NextRequest) {
  if (bloqueado() || req.headers.get('x-massa-local') !== 'qa') return error('Indisponível.', 404)
  const corpo = await req.json().catch(() => ({})) as { etapa?: string; limite?: number }
  try {
    if (corpo.etapa === 'atletas') return success(await preencherEquipesVazias(Math.min(Number(corpo.limite) || 25, 40)))
    if (corpo.etapa === 'copa') return success(await criarCopaMassa())
    return error('Informe a etapa atletas ou copa.', 422)
  } catch (falha) {
    return error('A massa não foi concluída.', 500, falha instanceof Error ? falha.message : String(falha))
  }
}
