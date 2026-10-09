import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorDaLiga, exigirOrganizadorDaPartida } from '@/lib/organizador-isolamento'
import { partidaSchema } from '@/lib/schemas'
import { camposEditaveisDaPartida, equipesPertencemALiga } from '@/lib/partida-escrita'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error: err } = await supabase
    .from('Partida')
    .select('id,rodada,fase,status,dataHora,localNome,setsPorA,setsPorB,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex,logoUrl),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex,logoUrl),sets:SetPartida(numero,pontosA,pontosB)')
    .eq('id', Number(id))
    .single()
  if (err) {
    if (err.code === 'PGRST116') return error('Partida não encontrada', 404)
    console.error('[api/partidas/id] erro ao buscar partida', err)
    return error('Não foi possível carregar a partida agora. Tente novamente em instantes.', 500)
  }
  return success(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await exigirOrganizadorDaPartida(req, Number(id))
  if (acesso instanceof NextResponse) return acesso
  try {
    const body = await req.json()
    const parsed = partidaSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    if (parsed.data.ligaId) {
      const destino = await exigirOrganizadorDaLiga(req, Number(parsed.data.ligaId))
      if (destino instanceof NextResponse) return destino
    }

    const { data: atual } = await supabase.from('Partida').select('ligaId,equipeAId,equipeBId').eq('id', Number(id)).maybeSingle()
    if (atual?.ligaId) {
      const bloqueio = await rejectIfCampeonatoFinalizado(Number(atual.ligaId))
      if (bloqueio) return bloqueio
    }

    const patch = camposEditaveisDaPartida(parsed.data)
    if (Object.keys(patch).length === 0) return error('Dados inválidos', 422)
    if (atual && (patch.equipeAId !== undefined || patch.equipeBId !== undefined || patch.ligaId !== undefined)) {
      const ligaId = Number(patch.ligaId ?? atual.ligaId)
      const equipeAId = Number(patch.equipeAId ?? atual.equipeAId)
      const equipeBId = Number(patch.equipeBId ?? atual.equipeBId)
      if (equipeAId === equipeBId) return error('As equipes da partida precisam ser diferentes.', 422)
      const equipesOk = await equipesPertencemALiga(ligaId, [equipeAId, equipeBId])
      if (!equipesOk) return error('As equipes precisam pertencer a este campeonato.', 422)
    }

    const { data, error: err } = await supabase
      .from('Partida')
      .update(patch)
      .eq('id', Number(id))
      .select()
      .single()
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao atualizar partida', 500)
  }
}
