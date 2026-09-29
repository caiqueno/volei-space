import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { data: ligas, error: ligasErr } = await supabase
    .from('Liga')
    .select('id')
    .eq('organizadorId', auth.userId)

  if (ligasErr) return error('Erro ao carregar campeonatos', 500, ligasErr.message)

  const ligaIds = (ligas ?? []).map((liga: any) => liga.id)
  if (ligaIds.length === 0) return success([])

  const { data, error: partidasErr } = await supabase
    .from('Partida')
    .select('id,ligaId,rodada,status,dataHora,localNome,setsPorA,setsPorB,pontosPorA,pontosPorB,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex),liga:Liga!Partida_ligaId_fkey(id,nome,simulacao),escala:EscalaArbitro(id,arbitroId,cargo,arbitro:Arbitro(id,nome,email))')
    .in('ligaId', ligaIds)
    .order('dataHora', { ascending: true })

  if (partidasErr) return error('Erro ao carregar partidas', 500, partidasErr.message)
  return success(data ?? [])
}
