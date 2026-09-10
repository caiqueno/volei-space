import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'

const STATUS_ABERTOS = ['AGENDADA', 'PENDENTE', 'PENDENTE_APROVACAO']
const STATUS_ARBITRO_APROVADO = ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO']

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['arbitro'])
  if (auth instanceof Response) return auth

  const candidatura = await getCandidaturaArbitro(auth.userId)
  if (!candidatura) return error('Cadastro de árbitro não encontrado.', 404)

  if (!isArbitroAprovado(candidatura.status)) {
    return success({
      arbitro: candidatura,
      elegivel: false,
      motivo: 'Seu cadastro de árbitro precisa ser aprovado pela organização antes de se candidatar para partidas.',
      partidas: [],
      filtros: null,
    })
  }

  const params = req.nextUrl.searchParams
  const periodo = params.get('periodo') ?? '30'
  const ligaId = Number(params.get('ligaId'))
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 12), 1), 40)

  const { data: candidaturas, error: candidaturasErr } = await supabase
    .from('CandidaturaPartidaArbitro')
    .select('*')
    .eq('candidaturaArbitroId', candidatura.id)

  if (candidaturasErr) return error('Erro ao buscar candidaturas do árbitro.', 500)

  let query = supabase
    .from('Partida')
    .select('*, liga:Liga(*), equipeA:Equipe!equipeAId(*), equipeB:Equipe!equipeBId(*), escala:EscalaArbitro(*)')
    .in('status', STATUS_ABERTOS)
    .order('dataHora', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (Number.isFinite(ligaId) && ligaId > 0) {
    query = query.eq('ligaId', ligaId)
  }

  if (periodo !== 'all') {
    const dias = Math.min(Math.max(Number(periodo) || 30, 1), 180)
    const agora = new Date()
    const dataLimite = new Date(agora)
    dataLimite.setDate(dataLimite.getDate() + dias)

    query = query.gte('dataHora', agora.toISOString()).lte('dataHora', dataLimite.toISOString())
  }

  const { data: partidas, error: partidasErr } = await query

  if (partidasErr) return error('Erro ao buscar partidas abertas.', 500)

  const candidaturaByPartida = new Map((candidaturas ?? []).map((item: any) => [item.partidaId, item]))
  const abertas = (partidas ?? [])
    .filter((partida: any) => !partida.escala || partida.escala.length === 0)
    .map((partida: any) => ({
      ...partida,
      minhaCandidatura: candidaturaByPartida.get(partida.id) ?? null,
    }))

  return success({
    arbitro: candidatura,
    elegivel: true,
    partidas: abertas,
    filtros: {
      periodo,
      ligaId: Number.isFinite(ligaId) && ligaId > 0 ? ligaId : null,
      limit,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePublicRole(req, ['arbitro'])
  if (auth instanceof Response) return auth

  const candidatura = await getCandidaturaArbitro(auth.userId)
  if (!candidatura) return error('Cadastro de árbitro não encontrado.', 404)
  if (!isArbitroAprovado(candidatura.status)) {
    return error('Seu cadastro de árbitro precisa ser aprovado antes de se candidatar para partidas.', 403)
  }

  const body = await req.json().catch(() => null)
  const partidaId = Number(body?.partidaId)
  if (!partidaId) return error('Partida inválida.', 422)

  const { data: partida, error: partidaErr } = await supabase
    .from('Partida')
    .select('id,status,escala:EscalaArbitro(*)')
    .eq('id', partidaId)
    .single()

  if (partidaErr || !partida) return error('Partida não encontrada.', 404)
  if (!STATUS_ABERTOS.includes(partida.status)) {
    return error('Esta partida não está aberta para candidatura.', 400)
  }
  if (partida.escala?.length) return error('Esta partida já possui árbitro escalado.', 409)

  const { data, error: upsertErr } = await supabase
    .from('CandidaturaPartidaArbitro')
    .upsert({
      partidaId,
      candidaturaArbitroId: candidatura.id,
      status: 'SOLICITADA',
    }, { onConflict: 'partidaId,candidaturaArbitroId' })
    .select()
    .single()

  if (upsertErr) return error('Erro ao registrar candidatura para a partida.', 500)
  return success(data, 201)
}

async function getCandidaturaArbitro(id: string) {
  const { data } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,arbitroId')
    .eq('id', id)
    .maybeSingle()

  return data
}

function isArbitroAprovado(status?: string | null) {
  return STATUS_ARBITRO_APROVADO.includes(String(status ?? '').trim().toUpperCase())
}
