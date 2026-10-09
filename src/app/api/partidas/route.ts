import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorDaLiga } from '@/lib/organizador-isolamento'
import { partidaSchema } from '@/lib/schemas'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { PARTIDA_PUBLICA_COLUNAS, normalizarPartidaPublica } from '@/lib/partida-publica'
import { equipesPertencemALiga } from '@/lib/partida-escrita'
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
  try {
    const body = await req.json()
    const parsed = partidaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorDaLiga(req, Number(parsed.data.ligaId))
    if (acesso instanceof NextResponse) return acesso
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(parsed.data.ligaId))
    if (bloqueio) return bloqueio

    const { data: categoria } = await supabase
      .from('CategoriaCampeonato')
      .select('id')
      .eq('ligaId', parsed.data.ligaId)
      .eq('codigo', parsed.data.categoria)
      .is('removidaEm', null)
      .maybeSingle()
    if (!categoria) return error('Esta categoria não está disponível no campeonato.', 422)
    if (parsed.data.equipeAId === parsed.data.equipeBId) return error('As equipes da partida precisam ser diferentes.', 422)
    const equipesOk = await equipesPertencemALiga(parsed.data.ligaId, [parsed.data.equipeAId, parsed.data.equipeBId])
    if (!equipesOk) return error('As equipes precisam pertencer a este campeonato.', 422)

    const token = uuidv4()
    const { data, error: err } = await supabase
      .from('Partida')
      .insert({ ...parsed.data, serie: null, categoriaCampeonatoId: categoria.id, sumulaToken: token, sumulaTokenExpira: null })
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch (err) {
    console.error('[api/partidas] erro ao criar partida', err)
    return error('Não foi possível criar a partida agora. Tente novamente em instantes.', 500)
  }
}
