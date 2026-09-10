import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { partidaSchema } from '@/lib/schemas'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ligaId = searchParams.get('ligaId')
    const categoria = searchParams.get('categoria')
    const serie = searchParams.get('serie')
    const rodada = searchParams.get('rodada')

    let q = supabase
      .from('Partida')
      .select('*, equipeA:Equipe!equipeAId(*), equipeB:Equipe!equipeBId(*), sets:SetPartida(*), escala:EscalaArbitro(*, arbitro:Arbitro(*))')
      .order('rodada', { ascending: true })
      .order('dataHora', { ascending: true })

    if (ligaId) q = q.eq('ligaId', Number(ligaId))
    if (categoria) q = q.eq('categoria', categoria)
    if (serie) q = q.eq('serie', serie)
    if (rodada) q = q.eq('rodada', Number(rodada))

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch (err) {
    console.error('[api/partidas] erro ao buscar partidas', err)
    return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  try {
    const body = await req.json()
    const parsed = partidaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const token = uuidv4()
    const { data, error: err } = await supabase
      .from('Partida')
      .insert({ ...parsed.data, sumulaToken: token, sumulaTokenExpira: null })
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch (err) {
    console.error('[api/partidas] erro ao criar partida', err)
    return error('Não foi possível criar a partida agora. Tente novamente em instantes.', 500)
  }
}
