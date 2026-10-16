import assert from 'node:assert/strict'
import { calcularClassificacao } from '../src/lib/classificacao'
import { mensagemSancaoInvalida, punicoesPorOcorrencia, sancaoEfetiva, suspensaoAutomatica, tipoSancaoDaOcorrencia } from '../src/lib/sancoes'

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

// M3: o marcador [[SAN:...]] distingue o que a tela grava como CARTAO_VERMELHO
const san = (sancao: string) => ({ tipo: 'CARTAO_VERMELHO', descricao: `10:00 | 1x0 | [Cartão vermelho] A - B: x [[SAN:A:J.7:GROSSEIRA:${sancao}:1]]` })
assert.equal(tipoSancaoDaOcorrencia(san('PENALIDADE')), 'PENALIDADE')
assert.equal(tipoSancaoDaOcorrencia(san('EXPULSAO')), 'EXPULSAO')
assert.equal(tipoSancaoDaOcorrencia(san('DESQUALIFICACAO')), 'DESQUALIFICACAO')
// nota antiga sem marcador e marcador sem sanção do servidor mantêm a leitura anterior
assert.equal(tipoSancaoDaOcorrencia({ tipo: 'CARTAO_VERMELHO', descricao: 'sem marcador' }), 'EXPULSAO')
assert.equal(tipoSancaoDaOcorrencia({ tipo: 'CARTAO_VERMELHO' }), 'EXPULSAO')
assert.equal(tipoSancaoDaOcorrencia(san('ADVERTENCIA_VERBAL')), 'EXPULSAO')
// tipo explícito não é reescrito pelo marcador
assert.equal(tipoSancaoDaOcorrencia({ tipo: 'CARTAO_AMARELO', descricao: san('EXPULSAO').descricao }), 'ADVERTENCIA')
// penalidade pesa 1 e desqualificação 2 (antes tudo virava expulsão)
const pesosSan = punicoesPorOcorrencia([
  { ...san('PENALIDADE'), jogadorId: 1 },
  { ...san('DESQUALIFICACAO'), jogadorId: 2 },
], new Map([[1, 10], [2, 11]]))
assert.equal(pesosSan.get(10), 1)
assert.equal(pesosSan.get(11), 2)
// amarelo, penalidade e expulsão da tela seguem a escala sem recusa indevida
assert.equal(mensagemSancaoInvalida([
  { tipo: 'CARTAO_AMARELO', jogadorId: 7 },
  { ...san('PENALIDADE'), jogadorId: 7 },
  { ...san('EXPULSAO'), jogadorId: 7 },
]), null)
assert.equal(mensagemSancaoInvalida([
  { ...san('PENALIDADE'), jogadorId: 7 },
  { ...san('PENALIDADE'), jogadorId: 7 },
]), 'A sanção deste atleta precisa ser registrada como expulsão.')

console.log('Sanções passaram: acumulação, suspensão e punições.')
