import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { THIRD_PLACE_FASE } from '@/lib/mata-mata'

export type PodiumTeam = {
  equipeId: number
  nome: string
  logoUrl: string | null
  corHex: string | null
  posicao: 1 | 2 | 3
}

function isDecided(partida: { status: string; vencedorId: number | null } | undefined): partida is { status: string; vencedorId: number; equipeAId: number; equipeBId: number } & Record<string, any> {
  if (!partida) return false
  const finished = partida.status === 'ENCERRADA' || partida.status === 'WO'
  return finished && partida.vencedorId != null
}

export async function getChampionshipPodium(ligaId: number): Promise<PodiumTeam[]> {
  const { data: partidas } = await supabase
    .from('Partida')
    .select('fase,rodada,status,vencedorId,equipeAId,equipeBId')
    .eq('ligaId', ligaId)
    .in('fase', ['FINAL', THIRD_PLACE_FASE])
    .eq('rodada', 1)

  const final = (partidas ?? []).find((p: any) => p.fase === 'FINAL')
  if (!isDecided(final)) return []

  const campeaoId = final.vencedorId
  const viceId = final.equipeAId === campeaoId ? final.equipeBId : final.equipeAId

  const disputa3 = (partidas ?? []).find((p: any) => p.fase === THIRD_PLACE_FASE)
  const terceiroId = isDecided(disputa3) ? disputa3.vencedorId : null

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
