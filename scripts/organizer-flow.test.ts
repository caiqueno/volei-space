import assert from 'node:assert/strict'
import { resolveLeagueLifecycleStatus } from '../src/lib/championship-lifecycle'

type Registration = { leagueId: number; teamId: number; status: 'SOLICITADA' | 'APROVADA' | 'REJEITADA' }

function approvedTeams(registrations: Registration[], leagueId: number) {
  return registrations
    .filter((item) => item.leagueId === leagueId && item.status === 'APROVADA')
    .map((item) => item.teamId)
}

function distribute(teamIds: number[], groupCount: number) {
  return Array.from({ length: groupCount }, (_, groupIndex) =>
    teamIds.filter((_, teamIndex) => teamIndex % groupCount === groupIndex),
  )
}

function matchCount(groups: number[][], homeAndAway = false) {
  return groups.reduce((total, group) => total + (group.length * (group.length - 1)) / 2, 0) * (homeAndAway ? 2 : 1)
}

const registrations: Registration[] = [
  { leagueId: 10, teamId: 1, status: 'SOLICITADA' },
  { leagueId: 10, teamId: 2, status: 'APROVADA' },
  { leagueId: 10, teamId: 3, status: 'APROVADA' },
  { leagueId: 10, teamId: 4, status: 'REJEITADA' },
  { leagueId: 10, teamId: 5, status: 'APROVADA' },
  { leagueId: 10, teamId: 6, status: 'APROVADA' },
  { leagueId: 11, teamId: 7, status: 'APROVADA' },
]

assert.deepEqual(approvedTeams(registrations, 10), [2, 3, 5, 6], 'somente equipes aprovadas entram na estrutura')
assert.deepEqual(distribute([2, 3, 5, 6], 2), [[2, 5], [3, 6]], 'sorteio distribui equipes sem repeticao')
assert.equal(matchCount([[2, 5], [3, 6]]), 2, 'turno simples gera um confronto por grupo de duas equipes')
assert.equal(matchCount([[2, 5], [3, 6]], true), 4, 'turno e returno duplica confrontos')
assert.equal(resolveLeagueLifecycleStatus([]), 'EM_BREVE')
assert.equal(resolveLeagueLifecycleStatus(['AGENDADA', 'AGENDADA']), 'EM_BREVE')
assert.equal(resolveLeagueLifecycleStatus(['ENCERRADA', 'AGENDADA']), 'ATIVA')
assert.equal(resolveLeagueLifecycleStatus(['EM_ANDAMENTO', 'AGENDADA']), 'ATIVA')
assert.equal(resolveLeagueLifecycleStatus(['ENCERRADA', 'CANCELADA']), 'ENCERRADA')

console.log('Fluxo do organizador validado: inscricao, aprovacao, grupos, confrontos e ciclo de vida.')
