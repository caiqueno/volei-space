import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function replaceLeagueTeamReferences(ligaId: number, staleEquipeId: number, canonicalEquipeId: number) {
  if (staleEquipeId === canonicalEquipeId) return
  await replaceGrupoEquipe(ligaId, staleEquipeId, canonicalEquipeId)
  await replaceClassificacaoEntrada(ligaId, staleEquipeId, canonicalEquipeId)
  await replaceClassificacaoEliminatoria(ligaId, staleEquipeId, canonicalEquipeId)
  await supabase.from('Partida').update({ equipeAId: canonicalEquipeId }).eq('ligaId', ligaId).eq('equipeAId', staleEquipeId)
  await supabase.from('Partida').update({ equipeBId: canonicalEquipeId }).eq('ligaId', ligaId).eq('equipeBId', staleEquipeId)
}

async function replaceGrupoEquipe(ligaId: number, staleEquipeId: number, canonicalEquipeId: number) {
  const { data: canonicalLink } = await supabase
    .from('GrupoEquipeCampeonato')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('equipeId', canonicalEquipeId)
    .maybeSingle()

  if (canonicalLink) {
    await supabase.from('GrupoEquipeCampeonato').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
    return
  }

  const { error } = await supabase
    .from('GrupoEquipeCampeonato')
    .update({ equipeId: canonicalEquipeId })
    .eq('ligaId', ligaId)
    .eq('equipeId', staleEquipeId)

  if (error?.code === '42P01' || error?.code === 'PGRST205') return
  if (error?.code === '23505') {
    await supabase.from('GrupoEquipeCampeonato').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
  }
}

async function replaceClassificacaoEntrada(ligaId: number, staleEquipeId: number, canonicalEquipeId: number) {
  const { data: canonicalEntry } = await supabase
    .from('ClassificacaoEntrada')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('equipeId', canonicalEquipeId)
    .maybeSingle()

  if (canonicalEntry) {
    await supabase.from('ClassificacaoEntrada').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
    return
  }

  const { error } = await supabase
    .from('ClassificacaoEntrada')
    .update({ equipeId: canonicalEquipeId })
    .eq('ligaId', ligaId)
    .eq('equipeId', staleEquipeId)

  if (error?.code === '23505') {
    await supabase.from('ClassificacaoEntrada').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
  }
}

async function replaceClassificacaoEliminatoria(ligaId: number, staleEquipeId: number, canonicalEquipeId: number) {
  const { data: canonicalEntry } = await supabase
    .from('ClassificacaoEliminatoria')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('equipeId', canonicalEquipeId)
    .maybeSingle()

  if (canonicalEntry) {
    await supabase.from('ClassificacaoEliminatoria').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
    return
  }

  const { error } = await supabase
    .from('ClassificacaoEliminatoria')
    .update({ equipeId: canonicalEquipeId })
    .eq('ligaId', ligaId)
    .eq('equipeId', staleEquipeId)

  if (error?.code === '42P01' || error?.code === 'PGRST205') return
  if (error?.code === '23505') {
    await supabase.from('ClassificacaoEliminatoria').delete().eq('ligaId', ligaId).eq('equipeId', staleEquipeId)
  }
}
