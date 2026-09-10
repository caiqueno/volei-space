import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { syncLeagueLifecycle } from '@/lib/championship-operations'
import { requireSumulaTokenAccess } from '@/lib/sumula-access'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access

  if (access.partida.status === 'ENCERRADA') return error('Partida já encerrada.', 400)

  const { data, error: updateErr } = await supabase
    .from('Partida')
    .update({ status: 'EM_ANDAMENTO' })
    .eq('id', access.partida.id)
    .select()
    .single()

  if (updateErr) return error('Erro ao iniciar partida', 500)
  await syncLeagueLifecycle(access.partida.ligaId)
  return success(data)
}
