import assert from 'node:assert/strict'
import {
  atletaPelaCamisaDaSumula,
  camisaDaSumula,
  destaqueDoJogador,
  equipeIdPeloNome,
  mvpDasOcorrencias,
  passoDeFechamento,
  type AtletaMvp,
} from '../src/lib/mvp-partida'

const targetId = 274
const prideId = 277
const atletas: AtletaMvp[] = [
  { id: 3353, equipeId: targetId, nome: 'Luan Ottoni Lokkerbol', numeroCadastro: '9', numeroSumula: '10' },
  { id: 3354, equipeId: targetId, nome: 'Luan Rodrigues Nascimento', numeroCadastro: '10', numeroSumula: '13' },
  { id: 3396, equipeId: prideId, nome: 'Guilherme Dos Santos Pereira', numeroCadastro: '10', numeroSumula: null },
]
const equipes = [
  { id: targetId, nome: 'TARGET' },
  { id: prideId, nome: 'WINNERS PRIDE' },
]
const nomeParaId = (nome: string) => equipeIdPeloNome(nome, equipes)

assert.equal(camisaDaSumula(atletas[0]), '10')
assert.equal(camisaDaSumula(atletas[1]), '13')
assert.equal(camisaDaSumula(atletas[2]), '10')
assert.equal(atletaPelaCamisaDaSumula(atletas, '10', targetId)?.id, 3353)
assert.equal(atletaPelaCamisaDaSumula(atletas, '9', targetId), null)
assert.equal(atletaPelaCamisaDaSumula(atletas, '10', prideId)?.id, 3396)
assert.equal(atletaPelaCamisaDaSumula(atletas, '10'), null)

const anotacao1036 = '10:41 | 11 x 15 | [Observação] TARGET - #10 Luan Ottoni Lokkerbol - TARGET: MVP'
const outra = '10:20 | 08 x 10 | [Observação] TARGET - #10 Luan Ottoni Lokkerbol - TARGET: atraso na troca'
const mvp = mvpDasOcorrencias(
  [{ descricao: outra }, { descricao: anotacao1036 }],
  atletas,
  nomeParaId,
)
assert.equal(mvp?.id, 3353)
assert.equal(mvpDasOcorrencias([{ descricao: outra }], atletas, nomeParaId), null)
assert.deepEqual(destaqueDoJogador(mvp?.id), [{ jogadorId: 3353, tipo: 'MVP' }])
assert.deepEqual(destaqueDoJogador(''), [])

assert.equal(passoDeFechamento({
  partidaEncerrada: false,
  setsA: 1,
  setsB: 1,
  setsParaVencer: 2,
  setAtualPodeFechar: true,
  vencedorDoSetAtual: 'teamB',
}), 'encerrar-partida')
assert.equal(passoDeFechamento({
  partidaEncerrada: false,
  setsA: 1,
  setsB: 2,
  setsParaVencer: 2,
  setAtualPodeFechar: false,
  vencedorDoSetAtual: null,
}), 'encerrar-partida')
assert.equal(passoDeFechamento({
  partidaEncerrada: true,
  setsA: 1,
  setsB: 2,
  setsParaVencer: 2,
  setAtualPodeFechar: false,
  vencedorDoSetAtual: null,
}), 'oficializar')
assert.equal(passoDeFechamento({
  partidaEncerrada: false,
  setsA: 0,
  setsB: 0,
  setsParaVencer: 2,
  setAtualPodeFechar: true,
  vencedorDoSetAtual: 'teamA',
}), 'encerrar-set')
assert.equal(passoDeFechamento({
  partidaEncerrada: false,
  setsA: 0,
  setsB: 0,
  setsParaVencer: 2,
  setAtualPodeFechar: false,
  vencedorDoSetAtual: null,
}), null)

console.log('mvp-partida: ok')
