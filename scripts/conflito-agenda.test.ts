import assert from 'node:assert/strict'
import { conflitosDeAgenda, conflitosDeArbitro, diaDoJogo, lerDiasDisponiveis } from '../src/lib/conflito-agenda'

const sabado = '2026-10-10T20:00:00.000Z'
const sabadoPerto = '2026-10-10T20:30:00.000Z'
const sabadoLonge = '2026-10-10T22:30:00.000Z'
const segunda = '2026-10-12T15:00:00.000Z'

assert.equal(diaDoJogo(sabado), 'Sábado')
assert.equal(diaDoJogo(segunda), 'Segunda')
assert.deepEqual(lerDiasDisponiveis('["Segunda","Sábado"]'), ['Segunda', 'Sábado'])

const base = { id: 1, equipeAId: 10, equipeBId: 11, dataHora: sabado, localNome: 'Quadra 1' }
assert.deepEqual(conflitosDeAgenda([base], []), [])

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 2, equipeAId: 10, equipeBId: 12, dataHora: sabadoPerto, localNome: 'Quadra 2' }],
    [base],
  ),
  ['Uma equipe já tem outro jogo nesse horário.'],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 2, equipeAId: 20, equipeBId: 21, dataHora: sabadoPerto, localNome: 'quadra 1' }],
    [base],
  ),
  ['A quadra já tem outro jogo nesse horário.'],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 2, equipeAId: 20, equipeBId: 21, dataHora: sabadoLonge, localNome: 'Quadra 1' }],
    [base],
  ),
  [],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 2, equipeAId: 20, equipeBId: 21, dataHora: sabado, localNome: 'A definir' }],
    [{ ...base, localNome: 'A definir', equipeAId: 30, equipeBId: 31 }],
  ),
  [],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 1, equipeAId: 10, equipeBId: 11, dataHora: sabado, localNome: 'Quadra 1', diasA: ['Segunda'] }],
    [],
  ),
  ['O horário cai fora dos dias disponíveis da equipe.'],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 1, equipeAId: 10, equipeBId: 11, dataHora: segunda, localNome: 'Quadra 1', diasA: ['Segunda'] }],
    [],
  ),
  [],
)

assert.deepEqual(
  conflitosDeAgenda(
    [{ id: 2, equipeAId: 10, equipeBId: 12, dataHora: sabado, localNome: 'Quadra 9' }],
    [{ ...base, status: 'CANCELADA' }],
  ),
  [],
)

assert.deepEqual(conflitosDeArbitro([
  { arbitroId: 7, partidaId: 1, dataHora: sabado },
  { arbitroId: 7, partidaId: 2, dataHora: sabadoPerto },
]), ['O árbitro já está escalado em outro jogo nesse horário.'])
assert.deepEqual(conflitosDeArbitro([
  { arbitroId: 7, partidaId: 1, dataHora: sabado },
  { arbitroId: 7, partidaId: 1, dataHora: sabado },
  { arbitroId: 8, partidaId: 2, dataHora: sabado },
]), [])

console.log('Conflito de agenda passou: equipe, quadra, dia, jogo cancelado e árbitro.')
