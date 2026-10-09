import assert from 'node:assert/strict'
import { contarOrigens, ehPontoSemJogador, lerJogadorPonto, lerRotuloPonto, linhasUltimosPontos, textoPonto, textoPontoSemJogador } from '../src/lib/ponto-sumula'

const saque = textoPonto('ace', 'Time A', '7', 'Pedro Oliveira')
const bloqueio = textoPonto('block', 'Time B', '4', 'Carlos Santos')
const ataque = textoPonto('attack', 'Time A', '10', 'João Silva')

assert.equal(lerRotuloPonto(saque), '+1 Ponto de Saque')
assert.equal(lerRotuloPonto(bloqueio), '+1 Ponto de Bloqueio')
assert.equal(lerRotuloPonto(ataque), '+1 Ponto de Ataque')
assert.equal(lerJogadorPonto(ataque), 'João Silva')
assert.equal(lerJogadorPonto(bloqueio), 'Carlos Santos')
assert.equal(lerJogadorPonto(saque), 'Pedro Oliveira')
assert.match(ataque, /Ataque para Time A: #10 João Silva/)
assert.equal(lerRotuloPonto('Ponto para Time A: jogada coletiva.'), null)

const semJogador = textoPontoSemJogador('Time B')
assert.equal(ehPontoSemJogador(semJogador), true)
assert.equal(lerRotuloPonto(semJogador), '+1')
assert.equal(lerJogadorPonto(semJogador), 'Sem jogador')
assert.equal(ehPontoSemJogador(ataque), false)
assert.doesNotMatch(semJogador, /Atleta|undefined|null|desconhecido/i)
// Uma anotação do árbitro que cite a frase não pode virar ponto.
assert.equal(ehPontoSemJogador('[Observação] Time B - Comissão: ponto anterior ficou Sem jogador por engano.'), false)
assert.equal(ehPontoSemJogador('Ponto automático para Time A por cartão vermelho aplicado a Técnico.'), false)
assert.equal(lerJogadorPonto('[Observação] revisar o lance Sem jogador do set 2.'), null)

const historico = linhasUltimosPontos([
  { origem: 'ace', jogador: 'Pedro Oliveira' },
  { origem: 'block', jogador: 'Carlos Santos' },
  { origem: 'attack', jogador: 'João Silva' },
])
assert.deepEqual(historico, [
  '+1 Ponto de Ataque — João Silva',
  '+1 Ponto de Bloqueio — Carlos Santos',
  '+1 Ponto de Saque — Pedro Oliveira',
])

assert.deepEqual(contarOrigens(['ace', 'ace', 'attack', 'block', 'attack', 'attack']), {
  saque: 2,
  bloqueio: 1,
  ataque: 3,
})

console.log('Origem do ponto da súmula: rótulo, jogador, histórico e contagem por tipo.')
