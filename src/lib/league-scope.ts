import { supabaseAdmin } from '@/lib/supabase-admin'

export type LeagueScopeParams = {
  organizador?: string
  ligaId?: string
}

export async function getCreatorLeagueScope(params: LeagueScopeParams) {
  const organizadorId = params.organizador?.trim()
  if (!organizadorId) {
    const requestedId = Number(params.ligaId)
    if (!requestedId) return { organizadorId: null, ligas: [] as any[], selectedLiga: null as any | null }

    const { data, error } = await supabaseAdmin
      .from('Liga')
      .select('*')
      .eq('id', requestedId)
      .maybeSingle()

    if (error) throw error
    if (data?.simulacao === true) return { organizadorId: null, ligas: [] as any[], selectedLiga: null as any | null }

    return { organizadorId: null, ligas: data ? [data] : [], selectedLiga: data ?? null }
  }

  const { data, error } = await supabaseAdmin
    .from('Liga')
    .select('*')
    .eq('organizadorId', organizadorId)
    .order('criadoEm', { ascending: false })

  if (error) throw error

  const ligas = (data ?? []).filter((liga: { simulacao?: boolean | null }) => liga.simulacao !== true)
  const requestedId = Number(params.ligaId)
  const selectedLiga = ligas.find((liga: any) => liga.id === requestedId) ?? ligas[0] ?? null

  return { organizadorId, ligas, selectedLiga }
}
