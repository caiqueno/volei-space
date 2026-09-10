import assert from 'node:assert/strict'
import { findRepairableStaleRegistrations } from '../src/lib/registration-repair'

const teamById = new Map([
  [10, { id: 10, nome: 'Mundo Apto Shark' }],
  [20, { id: 20, nome: 'Mundo Apto Shark' }],
  [30, { id: 30, nome: 'Mundo Aptos Shark' }],
])

const linkedCandidaturaByTeamId = new Map([
  [20, 'cand-mundo-correta'],
  [30, 'cand-outra-equipe'],
])

const repairable = findRepairableStaleRegistrations({
  invitation: {
    id: 'convite-1',
    ligaId: 99,
    candidaturaEquipeId: 'cand-mundo-correta',
    nomeEquipe: 'Mundo Apto Shark',
  },
  candidatura: {
    id: 'cand-mundo-correta',
    nome: 'Mundo Apto Shark',
    equipeId: 20,
  },
  canonicalTeam: { id: 20, nome: 'Mundo Apto Shark' },
  registrations: [
    { id: 'inscricao-antiga', ligaId: 99, equipeId: 10, status: 'APROVADA' },
    { id: 'inscricao-correta', ligaId: 99, equipeId: 20, status: 'APROVADA' },
    { id: 'inscricao-parecida', ligaId: 99, equipeId: 30, status: 'APROVADA' },
    { id: 'inscricao-outra-liga', ligaId: 100, equipeId: 10, status: 'APROVADA' },
  ],
  teamById,
  linkedCandidaturaByTeamId,
})

assert.deepEqual(
  repairable,
  ['inscricao-antiga'],
  'somente inscricao orfa da mesma liga e mesmo nome deve ser reparada',
)

console.log('Sincronizacao de equipe/candidatura validada contra inscricao orfa e nomes similares.')
