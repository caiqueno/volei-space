import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorOuAdminDaPartida } from '@/lib/organizador-isolamento'
import { validateCategoryResult } from '@/lib/category-match-rules'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorOuAdminDaPartida(req, Number(id))
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

    const sets = ((partida.sets ?? []) as any[]).map((set) => ({
      numero: Number(set.numero),
      pontosA: Number(set.pontosA),
      pontosB: Number(set.pontosB),
    }))
    const regras = await regrasEfetivasDaPartida(partida)
    const placarInvalido = validateCategoryResult(sets, regras)
    if (placarInvalido) return error(placarInvalido, 422)

    let setsPorA = 0
    let setsPorB = 0
    let pontosPorA = 0
    let pontosPorB = 0
    for (const set of sets) {
      pontosPorA += set.pontosA
      pontosPorB += set.pontosB
      if (set.pontosA > set.pontosB) setsPorA += 1
      else if (set.pontosB > set.pontosA) setsPorB += 1
    }

    const vencedorId = setsPorA > setsPorB ? partida.equipeAId : setsPorB > setsPorA ? partida.equipeBId : null
    if (!vencedorId) return error('A partida precisa ter um vencedor antes da aprovação.', 422)

    const { data: updated, error: updateErr } = await supabase
      .from('Partida')
      .update({
        status: 'ENCERRADA',
        setsPorA,
        setsPorB,
        pontosPorA,
        pontosPorB,
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
