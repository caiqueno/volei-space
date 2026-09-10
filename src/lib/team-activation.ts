import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { slugify } from '@/utils/slug'
import { findRepairableStaleRegistrations, type RegistrationRecord, type TeamRecord } from './registration-repair'
import { replaceLeagueTeamReferences } from './team-reference-repair'

const RELEASED_TEAM_STATUS = ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO']

export function isTeamReleased(status?: string | null) {
  return RELEASED_TEAM_STATUS.includes(String(status ?? '').trim().toUpperCase())
}

export async function ensureEquipeForCandidatura(candidaturaId: string) {
  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaEquipe')
    .select('*, equipe:Equipe(*)')
    .eq('id', candidaturaId)
    .maybeSingle()

  if (candidaturaErr || !candidatura || !isTeamReleased(candidatura.status)) return null

  const linkedEquipe = Array.isArray(candidatura.equipe) ? candidatura.equipe[0] : candidatura.equipe
  if (candidatura.equipeId && linkedEquipe) {
    return syncEquipeActivation(candidatura, linkedEquipe)
  }

  const { data: existingEquipe } = await supabase
    .from('Equipe')
    .select('*')
    .eq('nome', candidatura.nome)
    .eq('ligaId', candidatura.ligaId)
    .eq('categoria', candidatura.categoria)
    .eq('serie', candidatura.serie)
    .maybeSingle()

  if (existingEquipe) {
    await supabase
      .from('CandidaturaEquipe')
      .update({ status: 'ATIVA', equipeId: existingEquipe.id })
      .eq('id', candidaturaId)
    return syncEquipeActivation(candidatura, existingEquipe)
  }

  const slug = await slugifyUniqueEquipe(candidatura.nome)
  const { data: equipe, error: equipeErr } = await supabase
    .from('Equipe')
    .insert({
      nome: candidatura.nome,
      ligaId: candidatura.ligaId,
      categoria: candidatura.categoria,
      serie: candidatura.serie,
      slug,
      statusEquipe: 'ATIVA',
      emblemaUrl: candidatura.emblemaUrl || null,
      logoUrl: candidatura.emblemaUrl || null,
      diasDisponiveis: candidatura.diasDisponiveis,
      horarios: candidatura.horarios,
      quadraInfo: candidatura.quadraInfo,
      inscricaoAtiva: true,
    })
    .select()
    .single()

  if (equipeErr || !equipe) return null

  await supabase
    .from('CandidaturaEquipe')
    .update({ status: 'ATIVA', equipeId: equipe.id })
    .eq('id', candidaturaId)

  return syncEquipeActivation(candidatura, equipe)
}

async function syncEquipeActivation(candidatura: any, equipe: any) {
  const update: Record<string, unknown> = {}
  if (equipe.ligaId !== candidatura.ligaId) update.ligaId = candidatura.ligaId
  if (equipe.categoria !== candidatura.categoria) update.categoria = candidatura.categoria
  if (equipe.serie !== candidatura.serie) update.serie = candidatura.serie
  if (equipe.statusEquipe !== 'ATIVA') update.statusEquipe = 'ATIVA'
  if (equipe.inscricaoAtiva !== true) update.inscricaoAtiva = true
  if (!equipe.logoUrl && candidatura.emblemaUrl) update.logoUrl = candidatura.emblemaUrl
  if (!equipe.emblemaUrl && candidatura.emblemaUrl) update.emblemaUrl = candidatura.emblemaUrl

  const canonicalEquipe = Object.keys(update).length
    ? await updateEquipe(equipe.id, update) ?? { ...equipe, ...update }
    : equipe

  await supabase
    .from('CandidaturaEquipe')
    .update({ status: 'ATIVA', equipeId: canonicalEquipe.id })
    .eq('id', candidatura.id)

  await syncAcceptedInvitationRegistrations(candidatura.id, canonicalEquipe.id)
  await repairCandidaturaLeagueRegistration(candidatura, canonicalEquipe)
  return canonicalEquipe
}

async function updateEquipe(equipeId: number, update: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('Equipe')
    .update(update)
    .eq('id', equipeId)
    .select()
    .single()

  if (error) {
    console.error('[team-activation] erro ao sincronizar equipe ativa', error)
    return null
  }
  return data
}

async function syncAcceptedInvitationRegistrations(candidaturaId: string, equipeId: number) {
  const { data: invitations, error: invitationError } = await supabase
    .from('ConviteEquipe')
    .select('ligaId,status')
    .eq('candidaturaEquipeId', candidaturaId)
    .eq('status', 'ACEITO')

  if (invitationError) {
    console.error('[team-activation] erro ao buscar convites aceitos', invitationError)
    return
  }

  for (const invitation of invitations ?? []) {
    const { error } = await supabase
      .from('InscricaoCampeonato')
      .upsert({
        ligaId: invitation.ligaId,
        equipeId,
        status: 'APROVADA',
      }, { onConflict: 'ligaId,equipeId' })

    if (error) {
      console.error('[team-activation] erro ao sincronizar inscricao do convite aceito', error)
    }
  }
}

async function repairCandidaturaLeagueRegistration(candidatura: any, equipe: any) {
  if (!candidatura?.ligaId || !equipe?.id) return

  const { data: registrations, error: registrationsError } = await supabase
    .from('InscricaoCampeonato')
    .select('id,ligaId,equipeId,status')
    .eq('ligaId', candidatura.ligaId)

  if (registrationsError) {
    console.error('[team-activation] erro ao buscar inscricoes da liga da candidatura', registrationsError)
    return
  }

  const teamIds = Array.from(new Set((registrations ?? []).map((item: any) => Number(item.equipeId)).filter(Number.isInteger)))
  if (!teamIds.length) return

  const [{ data: registeredTeams, error: teamsError }, { data: linkedCandidaturas, error: linkedError }] = await Promise.all([
    supabase.from('Equipe').select('id,nome').in('id', teamIds),
    supabase.from('CandidaturaEquipe').select('id,equipeId').in('equipeId', teamIds),
  ])

  if (teamsError || linkedError) {
    console.error('[team-activation] erro ao preparar reparo de inscricao da candidatura', teamsError || linkedError)
    return
  }

  const registrationById = new Map((registrations ?? []).map((item: any) => [String(item.id), item as RegistrationRecord]))
  const teamById = new Map((registeredTeams ?? []).map((item: any) => [Number(item.id), item as TeamRecord]))
  const linkedCandidaturaByTeamId = new Map(
    (linkedCandidaturas ?? []).map((item: any) => [Number(item.equipeId), String(item.id)]),
  )
  const current = (registrations ?? []).find((item: any) => Number(item.equipeId) === Number(equipe.id))
  const repairableIds = findRepairableStaleRegistrations({
    invitation: {
      id: `candidatura-${candidatura.id}`,
      ligaId: Number(candidatura.ligaId),
      candidaturaEquipeId: String(candidatura.id),
      nomeEquipe: candidatura.nome,
    },
    candidatura: {
      id: String(candidatura.id),
      nome: candidatura.nome,
      equipeId: equipe.id,
    },
    canonicalTeam: equipe,
    registrations: (registrations ?? []) as RegistrationRecord[],
    teamById,
    linkedCandidaturaByTeamId,
  })

  for (const registrationId of repairableIds) {
    const stale = registrationById.get(registrationId)
    if (!stale) continue

    await replaceLeagueTeamReferences(Number(candidatura.ligaId), stale.equipeId, equipe.id)

    if (!current) {
      const nextStatus = String(stale.status).toUpperCase() === 'APROVADA' ? 'APROVADA' : 'SOLICITADA'
      const { error: upsertError } = await supabase
        .from('InscricaoCampeonato')
        .upsert({
          ligaId: Number(candidatura.ligaId),
          equipeId: equipe.id,
          status: nextStatus,
        }, { onConflict: 'ligaId,equipeId' })
      if (upsertError) {
        console.error('[team-activation] erro ao recriar inscricao canonica', upsertError)
        continue
      }
    }

    const { error: deleteError } = await supabase.from('InscricaoCampeonato').delete().eq('id', stale.id)
    if (deleteError) console.error('[team-activation] erro ao remover inscricao orfa', deleteError)
  }
}

async function slugifyUniqueEquipe(nome: string) {
  const base = slugify(nome)
  const { data } = await supabase.from('Equipe').select('slug').like('slug', `${base}%`)
  const existing = new Set((data ?? []).map((e: any) => e.slug).filter(Boolean))
  if (!existing.has(base)) return base

  let index = 2
  while (existing.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}
