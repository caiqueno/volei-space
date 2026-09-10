export type InvitationRecord = {
  id: string
  ligaId: number
  candidaturaEquipeId: string | null
  nomeEquipe?: string | null
}

export type RegistrationRecord = {
  id: string
  ligaId: number
  equipeId: number
  status: string
}

export type TeamRecord = {
  id: number
  nome?: string | null
}

export type CandidaturaRecord = {
  id: string
  nome?: string | null
  equipeId?: number | null
}

export function findRepairableStaleRegistrations(params: {
  invitation: InvitationRecord
  candidatura?: CandidaturaRecord | null
  canonicalTeam: TeamRecord
  registrations: RegistrationRecord[]
  teamById: Map<number, TeamRecord>
  linkedCandidaturaByTeamId: Map<number, string>
}) {
  const acceptedCandidaturaId = String(params.invitation.candidaturaEquipeId ?? '')
  const canonicalTeamId = Number(params.canonicalTeam.id)
  const expectedNames = [
    params.invitation.nomeEquipe,
    params.candidatura?.nome,
    params.canonicalTeam.nome,
  ].map(normalizeTeamName).filter(Boolean)

  if (!acceptedCandidaturaId || !canonicalTeamId || expectedNames.length === 0) return []

  return params.registrations
    .filter((registration) => registration.ligaId === params.invitation.ligaId)
    .filter((registration) => registration.equipeId !== canonicalTeamId)
    .filter((registration) => String(registration.status).toUpperCase() !== 'REJEITADA')
    .filter((registration) => {
      const linkedCandidaturaId = params.linkedCandidaturaByTeamId.get(registration.equipeId)
      return !linkedCandidaturaId || linkedCandidaturaId === acceptedCandidaturaId
    })
    .filter((registration) => {
      const teamName = normalizeTeamName(params.teamById.get(registration.equipeId)?.nome)
      return Boolean(teamName && expectedNames.some((expected) => teamName === expected))
    })
    .map((registration) => registration.id)
}

function normalizeTeamName(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}
