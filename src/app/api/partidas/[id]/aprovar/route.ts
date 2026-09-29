import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params

  try {
    const { data: partida, error: fetchErr } = await supabase
      .from('Partida')
      .select('*, sets:SetPartida(*)')
      .eq('id', Number(id))
      .single()

    if (fetchErr || !partida) return error('Partida não encontrada', 404)
    if (partida.status !== 'PENDENTE_APROVACAO') return error('Partida não está pendente de aprovação', 400)
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
    if (bloqueio) return bloqueio

    // Calculate sets won
    const sets = (partida.sets ?? []) as any[]
    let setsPorA = 0, setsPorB = 0
    for (const s of sets) {
      if (s.pontosA > s.pontosB) setsPorA++
      else if (s.pontosB > s.pontosA) setsPorB++
    }

    const vencedorId = setsPorA > setsPorB ? partida.equipeAId : setsPorB > setsPorA ? partida.equipeBId : null

    const { data: updated, error: updateErr } = await supabase
      .from('Partida')
      .update({
        status: 'ENCERRADA',
        setsPorA,
        setsPorB,
        vencedorId,
        sumulaAprovadaEm: new Date().toISOString(),
      })
      .eq('id', Number(id))
      .select()
      .single()

    if (updateErr) throw updateErr

    // Update classification for both teams
    await recalculateLeagueClassification(partida.ligaId)

    return success(updated)
  } catch {
    return error('Erro ao aprovar partida', 500)
  }
}
