import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'

export const dynamic = 'force-dynamic'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},pontosPorA,pontosPorB,liga:Liga!Partida_ligaId_fkey(id,nome,slug,descricao,simulacao)`

export async function GET() {
  const { data, error: falha } = await supabaseAdmin
    .from('Partida')
    .select(COLUNAS)
    .eq('status', 'EM_ANDAMENTO')
    .order('dataHora', { ascending: true })

  if (falha) return error('Não foi possível carregar as partidas ao vivo.', 500)
  const partidas = ((data ?? []) as Array<{ liga?: { nome?: string | null; slug?: string | null; descricao?: string | null; simulacao?: boolean | null } | null }>)
    .filter((partida) => !campeonatoDeTeste(partida.liga))
    .map(normalizarPartidaPublica)
    .filter((partida) => partida && partida.liga?.simulacao !== true)
  return success(partidas)
}
