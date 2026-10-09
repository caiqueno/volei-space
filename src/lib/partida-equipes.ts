import { supabaseAdmin } from '@/lib/supabase-admin'

export async function equipesPertencemALiga(equipeAId: number, equipeBId: number, ligaId: number) {
  if (!Number.isInteger(equipeAId) || !Number.isInteger(equipeBId) || !Number.isInteger(ligaId)) {
    return 'As equipes precisam pertencer a este campeonato.'
  }
  if (equipeAId === equipeBId) return 'As duas equipes devem ser diferentes.'

  const { data, error } = await supabaseAdmin
    .from('Equipe')
    .select('id,ligaId')
    .in('id', [equipeAId, equipeBId])
  if (error) throw error

  const equipes = data ?? []
  const equipeA = equipes.find((equipe) => Number(equipe.id) === equipeAId)
  const equipeB = equipes.find((equipe) => Number(equipe.id) === equipeBId)
  if (!equipeA || !equipeB || Number(equipeA.ligaId) !== ligaId || Number(equipeB.ligaId) !== ligaId) {
    return 'As equipes precisam pertencer a este campeonato.'
  }
  return null
}

export async function categoriaCampeonatoDaPartida(ligaId: number, codigo: string) {
  const { data, error } = await supabaseAdmin
    .from('CategoriaCampeonato')
    .select('id')
    .eq('ligaId', ligaId)
    .eq('codigo', codigo)
    .is('removidaEm', null)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}
