import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { partidaSchema } from '@/lib/schemas'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error: err } = await supabase
    .from('Partida')
    .select('*, equipeA:Equipe!equipeAId(*, jogadores:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl)), equipeB:Equipe!equipeBId(*, jogadores:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl)), sets:SetPartida(*), escala:EscalaArbitro(*, arbitro:Arbitro(*)), presencas:SumulaPresenca(*, jogador:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl)), ocorrencias:OcorrenciaPartida(*), destaques:DestaquesPartida(*, jogador:Jogador(id,nome,numero,posicao,fotoUrl,fotoRostoUrl))')
    .eq('id', Number(id))
    .single()
  if (err) return error('Partida não encontrada', 404)
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
