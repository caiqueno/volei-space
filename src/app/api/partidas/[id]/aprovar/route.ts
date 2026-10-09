import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorDaPartida } from '@/lib/organizador-isolamento'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDaPartida(req, Number(id))
  if (acesso instanceof NextResponse) return acesso

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

    try {
      await recalculateLeagueClassification(partida.ligaId)
    } catch (err) {
      console.error('[partidas/aprovar] partida aprovada; classificação não recalculada', err)
    }

    return success(updated)
  } catch (err) {
    console.error('[partidas/aprovar] erro', err)
    return error('Erro ao aprovar partida', 500)
  }
}
