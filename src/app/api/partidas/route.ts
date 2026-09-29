import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { partidaSchema } from '@/lib/schemas'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { PARTIDA_PUBLICA_COLUNAS, normalizarPartidaPublica } from '@/lib/partida-publica'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const ligaId = searchParams.get('ligaId')
    const categoria = searchParams.get('categoria')
    const categoriaCampeonatoId = searchParams.get('categoriaCampeonatoId')
    const rodada = searchParams.get('rodada')

    const { data: simuladas } = await supabase.from('Liga').select('id').eq('simulacao', true)
    const simulacaoIds = (simuladas ?? []).map((liga) => liga.id)

    let q = supabase
      .from('Partida')
      .select(`${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`)
      .order('rodada', { ascending: true })
      .order('dataHora', { ascending: true })

    if (ligaId) q = q.eq('ligaId', Number(ligaId))
    if (simulacaoIds.length) q = q.not('ligaId', 'in', `(${simulacaoIds.join(',')})`)
    if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    if (categoria) q = q.eq('categoria', categoria)
    if (rodada) q = q.eq('rodada', Number(rodada))

    const { data, error: err } = await q
    if (err) throw err
    const partidas = (data ?? []).map(normalizarPartidaPublica).filter((partida): partida is NonNullable<typeof partida> => Boolean(partida))
    return success(partidas)
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
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(parsed.data.ligaId))
    if (bloqueio) return bloqueio

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
