import { supabaseAdmin } from '@/lib/supabase-admin'
import { mensagemConfrontoForaDoGrupo, type VinculoDeGrupo } from '@/lib/grupos-fase'

async function vinculosDaCategoria(ligaId: number, categoriaCampeonatoId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('GrupoEquipeCampeonato')
    .select('equipeId,grupoId,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
  if (error) throw error
  return ((data ?? []) as Array<VinculoDeGrupo & { categoriaCampeonatoId?: string | null }>)
    .filter((vinculo) => !categoriaCampeonatoId || vinculo.categoriaCampeonatoId === categoriaCampeonatoId)
    .map((vinculo) => ({ equipeId: Number(vinculo.equipeId), grupoId: Number(vinculo.grupoId) }))
}

export async function recusarJogoDeGrupoCruzado(input: {
  ligaId: number
  categoriaCampeonatoId?: string | null
  fase?: string | null
  grupoId?: number | null
  equipeAId: number
  equipeBId: number
}) {
  const vinculos = await vinculosDaCategoria(input.ligaId, input.categoriaCampeonatoId)
  return mensagemConfrontoForaDoGrupo({
    fase: input.fase,
    grupoId: input.grupoId,
    equipeAId: input.equipeAId,
    equipeBId: input.equipeBId,
    vinculos,
  })
}

export async function grupoComumDasEquipes(ligaId: number, categoriaCampeonatoId: string | null, equipeAId: number, equipeBId: number) {
  const vinculos = await vinculosDaCategoria(ligaId, categoriaCampeonatoId)
  const grupoDe = new Map(vinculos.map((vinculo) => [vinculo.equipeId, vinculo.grupoId]))
  const grupoA = grupoDe.get(equipeAId)
  const grupoB = grupoDe.get(equipeBId)
  if (grupoA == null || grupoA !== grupoB) return null
  return grupoA
}
