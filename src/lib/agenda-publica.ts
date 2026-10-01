import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS, type PartidaPublica } from '@/lib/partida-publica'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`

function normalizar(linhas: unknown[] | null) {
  return (linhas ?? [])
    .map(normalizarPartidaPublica)
    .filter((partida): partida is PartidaPublica => Boolean(partida))
    .filter((partida) => partida.liga?.simulacao !== true)
}

export async function buscarPartidasPublicas(ligaIds: number[], completo: boolean) {
  if (ligaIds.length === 0) return { partidas: [] as PartidaPublica[], erro: false }
  if (completo) {
    const { data, error } = await supabaseAdmin
      .from('Partida')
      .select(COLUNAS)
      .in('ligaId', ligaIds)
      .order('dataHora', { ascending: true })
    if (error) return { partidas: [] as PartidaPublica[], erro: true }
    return { partidas: normalizar(data), erro: false }
  }

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [aoVivo, proximos, recentes] = await Promise.all([
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).eq('status', 'EM_ANDAMENTO').order('dataHora', { ascending: true }),
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).in('status', ['AGENDADA', 'PENDENTE']).gte('dataHora', desde).order('dataHora', { ascending: true }).limit(40),
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).in('status', ['ENCERRADA', 'WO']).order('dataHora', { ascending: false }).limit(20),
  ])
  const falha = aoVivo.error || proximos.error || recentes.error
  if (falha) return { partidas: [] as PartidaPublica[], erro: true }
  return { partidas: normalizar([...(aoVivo.data ?? []), ...(proximos.data ?? []), ...(recentes.data ?? [])]), erro: false }
}
