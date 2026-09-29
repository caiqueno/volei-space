import assert from 'node:assert/strict'
import {
  EMAIL_ARBITRO_SIMULACAO,
  INTERVALO_PONTO_MS,
  arbitroPodeOperar,
  avancarPlacar,
  definirVelocidade,
  ehSimulacao,
  pausarPlacar,
  placarInicial,
  podeApagarSimulacao,
  podeEncerrarPartida,
  podeIniciarPartida,
  retomarPlacar,
  setEncerrado,
  setsParaVencer,
} from '../src/lib/simulacao'

assert.equal(ehSimulacao({ simulacao: true }), true)
assert.equal(ehSimulacao({ simulacao: false }), false)
assert.equal(ehSimulacao(null), false)
assert.equal(podeApagarSimulacao({ simulacao: false }), false, 'limpeza não pode atingir campeonato real')
assert.equal(podeApagarSimulacao({ simulacao: true }), true)

assert.equal(setEncerrado(25, 20, 25, 2), true)
assert.equal(setEncerrado(25, 24, 25, 2), false)
assert.equal(setEncerrado(21, 19, 21, 2), true)
assert.equal(setsParaVencer(3), 2)

const inicio = 1_000_000
const alvo = 25
const margem = 2
let placar = placarInicial(inicio, 1)
const andamento = avancarPlacar(placar, inicio + INTERVALO_PONTO_MS, alvo, margem, 2)
assert.equal(andamento.placar.pontosA + andamento.placar.pontosB, 1, 'um ponto por intervalo')

const rapido = definirVelocidade(placarInicial(inicio, 1), 4, inicio)
const varios = avancarPlacar(rapido, inicio + INTERVALO_PONTO_MS, alvo, margem, 2)
assert.equal(varios.placar.pontosA + varios.placar.pontosB, 4, 'velocidade 4 gera quatro pontos no mesmo intervalo real')

const a = placarInicial(inicio, 1)
const b = placarInicial(inicio, 1)
const aPausado = pausarPlacar(a, inicio + 5000)
const bSegue = avancarPlacar(b, inicio + INTERVALO_PONTO_MS, alvo, margem, 2)
assert.equal(aPausado.pausada, true)
assert.equal(avancarPlacar(aPausado, inicio + INTERVALO_PONTO_MS * 3, alvo, margem, 2).placar.pontosA, 0)
assert.equal(bSegue.placar.pontosA + bSegue.placar.pontosB, 1, 'pausar uma partida não pausa a outra')

const retomado = retomarPlacar(aPausado, inicio + 9000)
assert.equal(retomado.pausada, false)

assert.equal(podeIniciarPartida('AGENDADA', 'ATIVA'), null)
assert.ok(podeIniciarPartida('AGENDADA', 'FINALIZADO'))
assert.ok(podeIniciarPartida('ENCERRADA', 'ATIVA'))
assert.ok(podeEncerrarPartida('AGENDADA', 'ATIVA'))
assert.equal(podeEncerrarPartida('EM_ANDAMENTO', 'ATIVA'), null)
assert.ok(podeEncerrarPartida('EM_ANDAMENTO', 'FINALIZADO'))

assert.equal(arbitroPodeOperar(7, [{ arbitroId: 7 }]), true)
assert.equal(arbitroPodeOperar(8, [{ arbitroId: 7 }]), false)
assert.equal(arbitroPodeOperar(7, []), false, 'sem escala o árbitro não opera a partida')

assert.equal(EMAIL_ARBITRO_SIMULACAO.test('simulacao-mesa@example.invalid'), true)
assert.equal(EMAIL_ARBITRO_SIMULACAO.test('pessoa@volei.space'), false)

let longo = placarInicial(inicio, 8)
longo = avancarPlacar(longo, inicio + INTERVALO_PONTO_MS * 40, alvo, margem, 2).placar
assert.ok(longo.setsA + longo.setsB >= 1, 'a sequência acelerada fecha ao menos um set com alvo e margem')

console.log('simulacao ok')
