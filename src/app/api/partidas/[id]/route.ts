import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorDaLiga, exigirOrganizadorDaPartida } from '@/lib/organizador-isolamento'
import { partidaAtualizacaoSchema } from '@/lib/schemas'
import { camposEditaveisDaPartida } from '@/lib/partida-escrita'
import { categoriaCampeonatoDaPartida, equipesPertencemALiga } from '@/lib/partida-equipes'
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
    const parsed = partidaAtualizacaoSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    if (parsed.data.ligaId) {
      const destino = await exigirOrganizadorDaLiga(req, Number(parsed.data.ligaId))
      if (destino instanceof NextResponse) return destino
    }

    const { data: atual, error: atualErr } = await supabase
      .from('Partida')
      .select('ligaId,equipeAId,equipeBId,categoria')
      .eq('id', Number(id))
      .maybeSingle()
    if (atualErr) throw atualErr
    if (!atual) return error('Partida não encontrada', 404)
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(atual.ligaId))
    if (bloqueio) return bloqueio

    const patch = camposEditaveisDaPartida(parsed.data)
    const ligaId = Number(patch.ligaId ?? atual.ligaId)

    if (patch.equipeAId !== undefined || patch.equipeBId !== undefined || patch.ligaId !== undefined) {
      const equipesInvalidas = await equipesPertencemALiga(
        Number(patch.equipeAId ?? atual.equipeAId),
        Number(patch.equipeBId ?? atual.equipeBId),
        ligaId,
      )
      if (equipesInvalidas) return error(equipesInvalidas, 422)
    }

    if (parsed.data.categoria || parsed.data.ligaId) {
      const categoriaId = await categoriaCampeonatoDaPartida(ligaId, String(parsed.data.categoria ?? atual.categoria))
      if (!categoriaId) return error('Esta categoria não está disponível no campeonato.', 422)
      patch.categoriaCampeonatoId = categoriaId
    }

    if (Object.keys(patch).length === 0) return error('Dados inválidos', 422)

    const { data, error: err } = await supabase
      .from('Partida')
      .update(patch)
      .eq('id', Number(id))
      .select()
      .single()
    if (err) throw err
    return success(data)
  } catch (err) {
    console.error('[api/partidas/id] erro ao atualizar partida', err)
    return error('Erro ao atualizar partida', 500)
  }
}
