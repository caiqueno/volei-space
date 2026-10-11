import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AVISO_ESCOLHA_MVP,
  atletaPelaCamisaDaSumula,
  camisaDaSumula,
  compararPontosMvp,
  destaqueDoJogador,
  deveAbrirModalMvp,
  equipeIdPeloNome,
  idDoMaiorPontuador,
  mvpDasOcorrencias,
  passoDeFechamento,
  pontosMvpDoJogador,
  pontosPorJogador,
  reabreModalMvp,
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

assert.equal(AVISO_ESCOLHA_MVP, 'A partida já tem vencedor. Escolha o MVP e oficialize a súmula.')
assert.equal(deveAbrirModalMvp({
  partidaEncerrada: true,
  temMvp: false,
  sumulaAprovada: false,
  jaAbriuNestaDeteccao: false,
}), true)
assert.equal(deveAbrirModalMvp({
  partidaEncerrada: true,
  temMvp: false,
  sumulaAprovada: false,
  jaAbriuNestaDeteccao: true,
}), false)
assert.equal(deveAbrirModalMvp({
  partidaEncerrada: true,
  temMvp: true,
  sumulaAprovada: false,
  jaAbriuNestaDeteccao: false,
}), false)
assert.equal(deveAbrirModalMvp({
  partidaEncerrada: false,
  temMvp: false,
  sumulaAprovada: false,
  jaAbriuNestaDeteccao: false,
}), false)
assert.equal(deveAbrirModalMvp({
  partidaEncerrada: true,
  temMvp: false,
  sumulaAprovada: true,
  jaAbriuNestaDeteccao: false,
}), false)
assert.equal(reabreModalMvp({ partidaEncerrada: true, sumulaAprovada: false }), true)
assert.equal(reabreModalMvp({ partidaEncerrada: true, sumulaAprovada: true }), false)
assert.equal(reabreModalMvp({ partidaEncerrada: false, sumulaAprovada: false }), false)

const atletasPartida = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
]
const pontos = pontosPorJogador([
  { tipo: 'attack', jogadorId: 1 },
  { tipo: 'ataque', jogadorId: 1 },
  { tipo: 'block', jogadorId: 1 },
  { tipo: 'ace', jogadorId: 1 },
  { tipo: 'ACE', jogadorId: 2 },
  { tipo: 'saque', jogadorId: 2 },
  { tipo: 'bloqueio', jogadorId: 2 },
  { tipo: 'attack', jogadorId: 2 },
  { tipo: 'attack', jogadorId: 2 },
  { tipo: 'point', jogadorId: 1, descricao: '+1 — Sem jogador. Ponto para Set Point sem jogador atribuído.' },
  { tipo: 'ponto', jogadorId: 3, descricao: 'Ponto de ataque para a equipe' },
  { tipo: 'attack', jogadorId: 3, descricao: 'Lance desfeito pelo árbitro' },
  { tipo: 'block', jogadorId: 3, descricao: 'Bloqueio anulado' },
  { tipo: 'ace', jogadorId: 3, descricao: 'Registro de andamento' },
  { tipo: 'attack', jogadorId: 3, descricao: '10:00 | 1 x 0 | Lance excluido' },
  { tipo: 'attack', jogadorId: null },
  { tipo: 'timeout', jogadorId: 1, descricao: 'Tempo' },
])
assert.deepEqual(pontosMvpDoJogador(pontos, 1), { ataque: 2, bloqueio: 1, ace: 1, total: 4 })
assert.deepEqual(pontosMvpDoJogador(pontos, 2), { ataque: 2, bloqueio: 1, ace: 2, total: 5 })
assert.deepEqual(pontosMvpDoJogador(pontos, 3), { ataque: 0, bloqueio: 0, ace: 0, total: 0 })
assert.equal(idDoMaiorPontuador(atletasPartida, pontos), '2')
assert.equal(idDoMaiorPontuador([{ id: 9 }], pontos), null)

const empate = pontosPorJogador([
  { tipo: 'attack', jogadorId: 1 },
  { tipo: 'ace', jogadorId: 1 },
  { tipo: 'attack', jogadorId: 2 },
  { tipo: 'ace', jogadorId: 2 },
])
assert.equal(idDoMaiorPontuador([{ id: 1 }, { id: 2 }], empate), null)

const desempateAce = pontosPorJogador([
  { tipo: 'attack', jogadorId: 1 },
  { tipo: 'attack', jogadorId: 1 },
  { tipo: 'attack', jogadorId: 2 },
  { tipo: 'ace', jogadorId: 2 },
])
assert.equal(idDoMaiorPontuador([{ id: 1 }, { id: 2 }], desempateAce), '2')

const desempateBloqueio = pontosPorJogador([
  { tipo: 'attack', jogadorId: 1 },
  { tipo: 'ace', jogadorId: 1 },
  { tipo: 'block', jogadorId: 2 },
  { tipo: 'ace', jogadorId: 2 },
])
assert.equal(idDoMaiorPontuador([{ id: 1 }, { id: 2 }], desempateBloqueio), '2')

assert.ok(compararPontosMvp(
  { ataque: 3, bloqueio: 0, ace: 1, total: 4 },
  { ataque: 1, bloqueio: 0, ace: 1, total: 4 },
) < 0)

const tela = readFileSync('src/app/sumula/[token]/lancar/page.tsx', 'utf8')
assert.equal(tela.includes('setEscolhaMvpId(sugestaoId)'), false)
assert.equal(tela.includes('setMvpId(sugestaoId)'), false)
assert.equal(tela.includes('idDoMaiorPontuador'), true)

console.log('mvp-partida: ok')
