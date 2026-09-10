import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { ensureClassificationAndCalendar } from '@/lib/championship-operations'
import {
  findRepairableStaleRegistrations,
  type CandidaturaRecord,
  type InvitationRecord,
  type RegistrationRecord,
  type TeamRecord,
} from './registration-repair'
import { replaceLeagueTeamReferences } from './team-reference-repair'

type ReconciliationResult = {
  created: number
  ignored: number
  unresolved: number
  repaired: number
}

/**
 * Converts accepted invitations into approved championship registrations.
 * Only invitations accepted by a team candidatura are materialized here.
 */
export async function reconcileAcceptedInvitations(
  ligaIds: number[],
): Promise<ReconciliationResult> {
  if (ligaIds.length === 0) return { created: 0, ignored: 0, unresolved: 0, repaired: 0 }

  const { data: invitations, error: invitationError } = await supabase
    .from('ConviteEquipe')
    .select('id,ligaId,candidaturaEquipeId,nomeEquipe')
    .in('ligaId', ligaIds)
    .eq('status', 'ACEITO')
    .not('candidaturaEquipeId', 'is', null)

  if (invitationError) throw invitationError
  const { data: existing, error: existingError } = await supabase
    .from('InscricaoCampeonato')
    .select('id,ligaId,equipeId,status')
    .in('ligaId', ligaIds)

  if (existingError) throw existingError

  const registeredTeamIds = Array.from(new Set((existing ?? []).map((item: any) => Number(item.equipeId)).filter(Number.isInteger)))
  const candidaturaIds = Array.from(new Set((invitations ?? []).map((item: any) => String(item.candidaturaEquipeId)).filter(Boolean)))
  const [{ data: registeredTeams, error: registeredTeamsError }, { data: candidaturas, error: candidaturasError }, { data: linkedCandidaturas, error: linkedCandidaturasError }] = await Promise.all([
    registeredTeamIds.length
      ? supabase.from('Equipe').select('id,nome').in('id', registeredTeamIds)
      : Promise.resolve({ data: [], error: null }),
    candidaturaIds.length
      ? supabase.from('CandidaturaEquipe').select('id,nome,equipeId').in('id', candidaturaIds)
      : Promise.resolve({ data: [], error: null }),
    registeredTeamIds.length
      ? supabase.from('CandidaturaEquipe').select('id,equipeId').in('equipeId', registeredTeamIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (registeredTeamsError) throw registeredTeamsError
  if (candidaturasError) throw candidaturasError
  if (linkedCandidaturasError) throw linkedCandidaturasError

  const existingByPair = new Map(
    (existing ?? []).map((item: any) => [`${item.ligaId}:${item.equipeId}`, item]),
  )
  const registrationById = new Map((existing ?? []).map((item: any) => [String(item.id), item as RegistrationRecord]))
  const teamById = new Map((registeredTeams ?? []).map((item: any) => [Number(item.id), item as TeamRecord]))
  const candidaturaById = new Map((candidaturas ?? []).map((item: any) => [String(item.id), item as CandidaturaRecord]))
  const linkedCandidaturaByTeamId = new Map(
    (linkedCandidaturas ?? []).map((item: any) => [Number(item.equipeId), String(item.id)]),
  )
  const rows: Array<{ ligaId: number; equipeId: number; status: string }> = []
  const pendingInvitationIds: string[] = []
  const approvedPairs: Array<{ ligaId: number; equipeId: number }> = []
  let ignored = 0
  let unresolved = 0
  let repaired = 0
  const reconciledCandidaturaIds = new Set<string>()

  for (const invitation of (invitations ?? []) as InvitationRecord[]) {
    const team = await ensureEquipeForCandidatura(String(invitation.candidaturaEquipeId))
    if (!team?.id) {
      unresolved += 1
      continue
    }
    reconciledCandidaturaIds.add(String(invitation.candidaturaEquipeId))

    const candidatura = candidaturaById.get(String(invitation.candidaturaEquipeId))
    const repairableIds = findRepairableStaleRegistrations({
      invitation,
      candidatura,
      canonicalTeam: team,
      registrations: (existing ?? []) as RegistrationRecord[],
      teamById,
      linkedCandidaturaByTeamId,
    })

    const key = `${invitation.ligaId}:${team.id}`
    const current = existingByPair.get(key) as any
    for (const registrationId of repairableIds) {
      const staleRegistration = registrationById.get(registrationId)
      if (!staleRegistration) continue
      await replaceLeagueTeamReferences(invitation.ligaId, staleRegistration.equipeId, team.id)
      await removeStaleRegistration(staleRegistration.id)
      repaired += 1
    }

    if (current?.status === 'SOLICITADA') {
      pendingInvitationIds.push(current.id)
      approvedPairs.push({ ligaId: invitation.ligaId, equipeId: team.id })
      existingByPair.set(key, { ...current, status: 'APROVADA' })
      continue
    }
    if (current) {
      ignored += 1
      continue
    }

    existingByPair.set(key, { ligaId: invitation.ligaId, equipeId: team.id, status: 'APROVADA' })
    approvedPairs.push({ ligaId: invitation.ligaId, equipeId: team.id })
    rows.push({ ligaId: invitation.ligaId, equipeId: team.id, status: 'APROVADA' })
  }

  const { data: activeCandidaturas, error: activeCandidaturasError } = await supabase
    .from('CandidaturaEquipe')
    .select('id')
    .in('ligaId', ligaIds)
    .in('status', ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'])

  if (activeCandidaturasError) throw activeCandidaturasError

  for (const candidatura of activeCandidaturas ?? []) {
    const candidaturaId = String(candidatura.id)
    if (!candidaturaId || reconciledCandidaturaIds.has(candidaturaId)) continue
    const team = await ensureEquipeForCandidatura(candidaturaId)
    if (!team?.id) unresolved += 1
  }

  if (pendingInvitationIds.length) {
    const { error: updateError } = await supabase
      .from('InscricaoCampeonato')
      .update({ status: 'APROVADA' })
      .in('id', pendingInvitationIds)
    if (updateError) throw updateError
  }

  if (rows.length) {
    const { error: insertError } = await supabase
      .from('InscricaoCampeonato')
      .insert(rows)
    if (insertError) throw insertError
  }

  for (const pair of approvedPairs) {
    const { data: registration, error: registrationError } = await supabase
      .from('InscricaoCampeonato')
      .select('id,ligaId,equipeId,liga:Liga(id,quantidadeEquipes,formato,quantidadeGrupos),equipe:Equipe(id,categoria,serie,nome)')
      .eq('ligaId', pair.ligaId)
      .eq('equipeId', pair.equipeId)
      .single()
    if (registrationError) throw registrationError
    await ensureClassificationAndCalendar(registration)
  }

  return { created: rows.length + pendingInvitationIds.length, ignored, unresolved, repaired }
}

async function removeStaleRegistration(registrationId: string) {
  const { error } = await supabase.from('InscricaoCampeonato').delete().eq('id', registrationId)
  if (error) throw error
}
