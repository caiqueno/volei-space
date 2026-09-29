import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { agruparPartidasPublicas, PARTIDA_PUBLICA_COLUNAS, normalizarPartidaPublica } from '@/lib/partida-publica'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const ligaParam = new URL(req.url).searchParams.get('ligaId')
  const ligaId = ligaParam == null || ligaParam === '' ? null : Number(ligaParam)
  if (ligaId != null && (!Number.isFinite(ligaId) || ligaId <= 0)) return error('Informe o campeonato.', 422)

  let idsPublicos: number[] = []
  if (ligaId != null) {
    const { data: liga, error: ligaErr } = await supabaseAdmin
      .from('Liga')
      .select('id,simulacao')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr) return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
    if (!liga || liga.simulacao === true) return error('Campeonato não encontrado.', 404)
    idsPublicos = [liga.id]
  } else {
    const { data: ligas, error: ligaErr } = await supabaseAdmin
      .from('Liga')
      .select('id')
      .eq('simulacao', false)
    if (ligaErr) return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
    idsPublicos = (ligas ?? []).map((liga) => liga.id)
  }

  const consulta = supabaseAdmin
    .from('Partida')
    .select(`${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`)
    .order('dataHora', { ascending: true })
  const { data, error: partidasErr } = idsPublicos.length
    ? await consulta.in('ligaId', idsPublicos)
    : { data: [], error: null }

  if (partidasErr) {
    console.error('[portal/jogos] erro ao buscar partidas', partidasErr)
    return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
  }

  const partidas = (data ?? []).map(normalizarPartidaPublica).filter((partida): partida is NonNullable<typeof partida> => Boolean(partida))
  const grupos = agruparPartidasPublicas(partidas)
  const resposta = success({ ...grupos, atualizadoEm: new Date().toISOString() })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
