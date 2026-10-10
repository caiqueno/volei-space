import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { THIRD_PLACE_FASE } from '@/lib/mata-mata'
import { vencedorDaPartida } from '@/lib/resultado-partida'

export type PodiumTeam = {
  equipeId: number
  nome: string
  logoUrl: string | null
  corHex: string | null
  posicao: 1 | 2 | 3
}

export async function getChampionshipPodium(ligaId: number, categoriaCampeonatoId?: string | null): Promise<PodiumTeam[]> {
  let consulta = supabase
    .from('Partida')
    .select('fase,rodada,status,vencedorId,equipeAId,equipeBId,setsPorA,setsPorB,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .in('fase', ['FINAL', THIRD_PLACE_FASE])
    .eq('rodada', 1)
  if (categoriaCampeonatoId) consulta = consulta.eq('categoriaCampeonatoId', categoriaCampeonatoId)
  const { data: partidas } = await consulta

  const final = (partidas ?? []).find((p: any) => p.fase === 'FINAL')
  const campeaoId = final ? vencedorDaPartida(final) : null
  if (campeaoId == null || !final) return []

  const viceId = Number(final.equipeAId) === campeaoId ? Number(final.equipeBId) : Number(final.equipeAId)

  const disputa3 = (partidas ?? []).find((p: any) => p.fase === THIRD_PLACE_FASE)
  const terceiroId = disputa3 ? vencedorDaPartida(disputa3) : null

  const equipeIds = [campeaoId, viceId, ...(terceiroId ? [terceiroId] : [])]
  const { data: equipes } = await supabase.from('Equipe').select('id,nome,logoUrl,corHex').in('id', equipeIds)
  const equipeById = new Map((equipes ?? []).map((equipe: any) => [Number(equipe.id), equipe]))

  const podium: PodiumTeam[] = []

  const campeaoEquipe = equipeById.get(campeaoId)
  if (campeaoEquipe) podium.push({ equipeId: campeaoId, nome: campeaoEquipe.nome, logoUrl: campeaoEquipe.logoUrl, corHex: campeaoEquipe.corHex, posicao: 1 })

  const viceEquipe = equipeById.get(viceId)
  if (viceEquipe) podium.push({ equipeId: viceId, nome: viceEquipe.nome, logoUrl: viceEquipe.logoUrl, corHex: viceEquipe.corHex, posicao: 2 })

  if (terceiroId) {
    const terceiroEquipe = equipeById.get(terceiroId)
    if (terceiroEquipe) podium.push({ equipeId: terceiroId, nome: terceiroEquipe.nome, logoUrl: terceiroEquipe.logoUrl, corHex: terceiroEquipe.corHex, posicao: 3 })
  }

  return podium
}
