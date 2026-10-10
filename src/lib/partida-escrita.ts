import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export const CAMPOS_PARTIDA_EDITAVEIS = ['ligaId', 'equipeAId', 'equipeBId', 'categoria', 'rodada', 'dataHora', 'localNome', 'localEndereco'] as const

export function camposEditaveisDaPartida(data: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  for (const campo of CAMPOS_PARTIDA_EDITAVEIS) {
    if (data[campo] !== undefined) saida[campo] = data[campo]
  }
  return saida
}

export function equipesConferemComLiga(ligaId: number, equipeIds: number[], encontradas: Array<{ id: number; ligaId: number }>) {
  const vistos = new Set<number>()
  for (let i = 0; i < equipeIds.length; i += 1) {
    if (vistos.has(equipeIds[i])) return false
    vistos.add(equipeIds[i])
  }
  if (equipeIds.length < 2) return false
  const porId = new Map(encontradas.map((equipe) => [Number(equipe.id), Number(equipe.ligaId)]))
  return equipeIds.every((id) => Number.isInteger(id) && id > 0 && porId.get(id) === ligaId)
}

export async function equipesPertencemALiga(ligaId: number, equipeIds: number[]) {
  const unicas: number[] = []
  equipeIds.forEach((id) => {
    if (!unicas.includes(id)) unicas.push(id)
  })
  const { data, error } = await supabase.from('Equipe').select('id,ligaId').in('id', unicas)
  if (error || !data) return false
  return equipesConferemComLiga(ligaId, equipeIds, data)
}
