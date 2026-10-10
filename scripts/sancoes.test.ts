import assert from 'node:assert/strict'
import { calcularClassificacao } from '../src/lib/classificacao'
import { mensagemSancaoInvalida, punicoesPorOcorrencia, sancaoEfetiva, suspensaoAutomatica } from '../src/lib/sancoes'

assert.equal(sancaoEfetiva([], 'ADVERTENCIA'), 'ADVERTENCIA')
assert.equal(sancaoEfetiva(['ADVERTENCIA'], 'ADVERTENCIA'), 'PENALIDADE')
assert.equal(sancaoEfetiva(['ADVERTENCIA', 'PENALIDADE'], 'ADVERTENCIA'), 'EXPULSAO')
assert.equal(sancaoEfetiva([], 'DESQUALIFICACAO'), 'DESQUALIFICACAO')
assert.equal(mensagemSancaoInvalida([
  { tipo: 'ADVERTENCIA', jogadorId: 7 },
  { tipo: 'ADVERTENCIA', jogadorId: 7 },
]), 'A sanção deste atleta precisa ser registrada como penalidade.')
assert.equal(mensagemSancaoInvalida([
  { tipo: 'ADVERTENCIA', jogadorId: 7 },
  { tipo: 'PENALIDADE', jogadorId: 7 },
]), null)

const pesos = punicoesPorOcorrencia([
  { tipo: 'PENALIDADE', jogadorId: 1 },
  { tipo: 'DESQUALIFICACAO', jogadorId: 2 },
  { tipo: 'CARTAO_VERMELHO', jogadorId: 2 },
], new Map([[1, 10], [2, 11]]))
assert.equal(pesos.get(10), 1)
assert.equal(pesos.get(11), 3)

assert.equal(suspensaoAutomatica([{ id: 1, sancoes: ['EXPULSAO'] }]).suspenso, true)
assert.equal(suspensaoAutomatica([
  { id: 1, sancoes: ['EXPULSAO'] },
  { id: 2, sancoes: [] },
]).suspenso, false)
assert.equal(suspensaoAutomatica([
  { id: 1, sancoes: ['ADVERTENCIA'] },
  { id: 2, sancoes: ['CARTAO_AMARELO'] },
]).motivo, 'Duas advertências acumuladas suspendem o atleta na próxima partida.')

const tabela = calcularClassificacao({
  times: [{ equipeId: 10, categoriaCampeonatoId: 'c', categoria: 'MISTO' }],
  partidas: [],
  punicoesPorEquipe: { 10: 2 },
})
assert.equal(tabela[0].punicoes, 2)
assert.equal(tabela[0].pontos, 0)

console.log('Sanções passaram: acumulação, suspensão e punições.')
