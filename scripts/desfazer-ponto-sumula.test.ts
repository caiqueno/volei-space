import assert from 'node:assert/strict'
import { desfazerRodizio, indiceDoUltimoPonto, reconstruirHistoricoPontos } from '../src/lib/desfazer-ponto-sumula'

const inicialA = ['1', '2', '3', '4', '5', '6']
const inicialB = ['7', '8', '9', '10', '11', '12']
const rodadaA = ['4', '1', '2', '5', '6', '3']

assert.deepEqual(desfazerRodizio(rodadaA), inicialA)

const semSaque = reconstruirHistoricoPontos({
  eventos: [
    { id: 'p1', type: 'point', text: '+1 — Sem jogador. Ponto para Alfa sem jogador atribuído.', set: 1, score: '01 x 00', teamId: 'teamA' },
  ],
  setAtual: 1,
  saqueAtual: 'teamA',
  escalacaoA: inicialA,
  escalacaoB: inicialB,
  nomeA: 'Alfa',
  nomeB: 'Beta',
})
assert.equal(semSaque.length, 1)
assert.deepEqual(semSaque[0].score, { teamA: 0, teamB: 0 })
assert.equal(semSaque[0].servingTeamId, 'teamA')
assert.deepEqual(semSaque[0].eventIds, ['p1'])
assert.deepEqual(semSaque[0].lineupA, inicialA)

const comTroca = reconstruirHistoricoPontos({
  eventos: [
    { id: 'p2', type: 'ace', text: '+1 Ponto de Saque — Ana. ACE para Beta: #7 Ana.', set: 1, score: '00 x 01', teamId: 'teamB' },
    { id: 't2', type: 'anotacao', text: `Troca de saque para Beta. [[ROT:20:teamB:${inicialA.join(',')}:${['10', '7', '8', '11', '12', '9'].join(',')}]]`, set: 1, score: '00 x 01', teamId: 'teamB' },
  ],
  setAtual: 1,
  saqueAtual: 'teamB',
  escalacaoA: inicialA,
  escalacaoB: ['10', '7', '8', '11', '12', '9'],
  nomeA: 'Alfa',
  nomeB: 'Beta',
})
assert.equal(comTroca.length, 1)
assert.deepEqual(comTroca[0].score, { teamA: 0, teamB: 0 })
assert.equal(comTroca[0].servingTeamId, 'teamA')
assert.deepEqual(comTroca[0].lineupB, inicialB)
assert.deepEqual(comTroca[0].eventIds, ['p2', 't2'])

const dois = reconstruirHistoricoPontos({
  eventos: [
    { id: 'novo', type: 'point', text: '+1 — Sem jogador. Ponto para Beta sem jogador atribuído.', set: 1, score: '01 x 01', teamId: 'teamB' },
    { id: 'velho', type: 'point', text: '+1 — Sem jogador. Ponto para Alfa sem jogador atribuído.', set: 1, score: '01 x 00', teamId: 'teamA' },
    { id: 'outro-set', type: 'point', text: '+1 — Sem jogador. Ponto para Alfa sem jogador atribuído.', set: 2, score: '05 x 00', teamId: 'teamA' },
  ],
  setAtual: 1,
  saqueAtual: 'teamA',
  escalacaoA: inicialA,
  escalacaoB: inicialB,
  nomeA: 'Alfa',
  nomeB: 'Beta',
})
assert.deepEqual(dois.map((item) => item.score), [{ teamA: 0, teamB: 0 }, { teamA: 1, teamB: 0 }])
assert.deepEqual(dois.map((item) => item.eventIds), [['velho'], ['novo']])
assert.equal(dois[1].score.teamA < 1 || dois[0].score.teamA === 0, true)

const vazio = reconstruirHistoricoPontos({
  eventos: [],
  setAtual: 1,
  saqueAtual: 'teamA',
  escalacaoA: inicialA,
  escalacaoB: inicialB,
  nomeA: 'Alfa',
  nomeB: 'Beta',
})
assert.equal(vazio.length, 0)

// Partida 1035: o set 2 estava 0x1 e o histórico ainda tinha o 23x13 do set 1.
// Corrigir o ponto do time A não pode restaurar esse placar no set 2.
const noSet2 = [
  { score: { teamA: 23, teamB: 13 }, set: 1 },
  { score: { teamA: 24, teamB: 13 }, set: 1 },
  { score: { teamA: 0, teamB: 0 }, set: 2 },
]
assert.equal(indiceDoUltimoPonto({
  historico: noSet2,
  placarAtual: { teamA: 0, teamB: 1 },
  setAtual: 2,
  equipe: 'teamA',
}), -1)
assert.equal(indiceDoUltimoPonto({
  historico: noSet2.slice(0, 2),
  placarAtual: { teamA: 0, teamB: 1 },
  setAtual: 2,
}), -1)
assert.equal(indiceDoUltimoPonto({
  historico: noSet2,
  placarAtual: { teamA: 0, teamB: 1 },
  setAtual: 2,
}), 2)
assert.deepEqual(noSet2[2].score, { teamA: 0, teamB: 0 })
const comPontoDoTimeA = [
  ...noSet2,
  { score: { teamA: 0, teamB: 1 }, set: 2 },
  { score: { teamA: 0, teamB: 2 }, set: 2 },
]
assert.equal(indiceDoUltimoPonto({
  historico: comPontoDoTimeA,
  placarAtual: { teamA: 1, teamB: 2 },
  setAtual: 2,
  equipe: 'teamA',
}), 4)
assert.deepEqual(comPontoDoTimeA[4].score, { teamA: 0, teamB: 2 })
assert.equal(indiceDoUltimoPonto({
  historico: [{ score: { teamA: 23, teamB: 13 } }],
  placarAtual: { teamA: 0, teamB: 1 },
  setAtual: 2,
  equipe: 'teamA',
}), -1)

console.log('desfazer-ponto-sumula ok')
