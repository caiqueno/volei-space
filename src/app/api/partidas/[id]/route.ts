import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { partidaSchema } from '@/lib/schemas'
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
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = partidaSchema.partial().safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { data: atual } = await supabase.from('Partida').select('ligaId').eq('id', Number(id)).maybeSingle()
    if (atual?.ligaId) {
      const bloqueio = await rejectIfCampeonatoFinalizado(Number(atual.ligaId))
      if (bloqueio) return bloqueio
    }

    const { data, error: err } = await supabase
      .from('Partida')
      .update(parsed.data)
      .eq('id', Number(id))
      .select()
      .single()
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao atualizar partida', 500)
  }
}
