import { success, error } from '@/lib/api-response'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { isSupabaseConfigured } from '@/lib/supabase-config'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

const COLUMNS = 'id,slug,nome,subtitulo,descricao,capaUrl,logoUrl,formato,dataInicio,dataFim,inscricoesAbertas,status,corTematica'

export async function GET() {
  if (!isSupabaseConfigured) return success([])

  const { data, error: ligasErr } = await supabase
    .from('Liga')
    .select(COLUMNS)
    .eq('status', 'ATIVA')
    .eq('simulacao', false)
    .order('dataInicio', { ascending: true, nullsFirst: false })

  if (ligasErr) return error('Não foi possível carregar os campeonatos ativos.', 500)

  const privadas = await idsCompeticoesPrivadas()
  const ligas = (data ?? []).filter((liga) => !campeonatoDeTeste(liga) && !privadas.has(Number(liga.id)))
  const ids = ligas.map((liga) => liga.id)
  const localPorLiga = new Map<number, string>()

  if (ids.length > 0) {
    const { data: partidas } = await supabase
      .from('Partida')
      .select('ligaId,localNome,dataHora')
      .in('ligaId', ids)
      .order('dataHora', { ascending: true })

    for (const partida of partidas ?? []) {
      const local = String(partida.localNome ?? '').trim()
      if (!local || localPorLiga.has(partida.ligaId)) continue
      localPorLiga.set(partida.ligaId, local)
    }
  }

  return success(ligas.map((liga) => ({
    id: liga.id,
    slug: liga.slug,
    nome: liga.nome,
    subtitulo: liga.subtitulo,
    descricao: liga.descricao,
    capaUrl: liga.capaUrl,
    logoUrl: liga.logoUrl,
    formato: liga.formato,
    dataInicio: liga.dataInicio,
    dataFim: liga.dataFim,
    inscricoesAbertas: liga.inscricoesAbertas !== false,
    corTematica: liga.corTematica,
    local: localPorLiga.get(liga.id) ?? null,
  })))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
