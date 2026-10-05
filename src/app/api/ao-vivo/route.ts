import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'

export const dynamic = 'force-dynamic'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},pontosPorA,pontosPorB,liga:Liga!Partida_ligaId_fkey(id,nome,slug,descricao,simulacao)`

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const limite = Math.min(24, Math.max(1, Number(params.get('limite') ?? 12) || 12))
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)
  const ligaId = Number(params.get('ligaId'))
  let consulta = supabaseAdmin
    .from('Partida')
    .select(COLUNAS)
    .eq('status', 'EM_ANDAMENTO')
    .order('dataHora', { ascending: true })
  if (Number.isInteger(ligaId) && ligaId > 0) consulta = consulta.eq('ligaId', ligaId)

  const { data, error: falha } = await consulta.range(offset, offset + limite)
  if (falha) return error('Não foi possível carregar as partidas ao vivo.', 500)
  const linhas = (data ?? []) as Array<{ liga?: { nome?: string | null; slug?: string | null; descricao?: string | null; simulacao?: boolean | null } | null }>
  const partidas = linhas
    .filter((partida) => !campeonatoDeTeste(partida.liga))
    .map(normalizarPartidaPublica)
    .filter((partida) => partida && partida.liga?.simulacao !== true)
    .slice(0, limite)
  const resposta = success({ partidas, temMais: linhas.length > limite })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
