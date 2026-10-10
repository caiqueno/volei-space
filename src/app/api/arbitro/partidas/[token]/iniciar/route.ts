import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { recalculateLeagueClassification, syncLeagueLifecycle } from '@/lib/championship-operations'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

const STATUS_BLOQUEADOS = new Set(['ENCERRADA', 'WO', 'CANCELADA'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access

  const status = String(access.partida.status || '').toUpperCase()
  if (STATUS_BLOQUEADOS.has(status)) return error('Esta partida não pode ser iniciada.', 400)
  const bloqueio = await rejectIfCampeonatoFinalizado(Number(access.partida.ligaId))
  if (bloqueio) return bloqueio

  const jaIniciada = status === 'EM_ANDAMENTO'
  const update: Record<string, unknown> = { status: 'EM_ANDAMENTO' }
  if (!access.partida.sumulaToken) update.sumulaToken = randomUUID()

  const { data, error: updateErr } = await supabase
    .from('Partida')
    .update(update)
    .eq('id', access.partida.id)
    .select('id,status,sumulaToken')
    .single()

  if (updateErr) return error('Erro ao iniciar partida', 500)
  if (!jaIniciada) {
    await supabase.from('OcorrenciaPartida').insert({
      partidaId: access.partida.id,
      tipo: 'OBSERVACAO',
      descricao: `Registro de início pelo árbitro ${access.candidatura.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}`,
    })
  }
  await syncLeagueLifecycle(access.partida.ligaId)
  if (!jaIniciada) {
    try {
      await recalculateLeagueClassification(access.partida.ligaId)
    } catch (err) {
      console.error('[partida] iniciada; classificação não recalculada', err)
    }
  }
  return success(data)
}
