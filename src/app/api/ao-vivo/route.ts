import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'

export const dynamic = 'force-dynamic'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},pontosPorA,pontosPorB,liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`

export async function GET() {
  const { data, error: falha } = await supabaseAdmin
    .from('Partida')
    .select(COLUNAS)
    .eq('status', 'EM_ANDAMENTO')
    .order('dataHora', { ascending: true })

  if (falha) return error('Não foi possível carregar as partidas ao vivo.', 500)
  const partidas = (data ?? [])
    .map(normalizarPartidaPublica)
    .filter((partida) => partida && partida.liga?.simulacao !== true)
  return success(partidas)
}
