import assert from 'node:assert/strict'
import { atribuirPontoAoEvento, opcoesDeOrigem, origemPrecisaEscolherAtleta, podeAtribuir } from '../src/lib/atribuicao-ponto'
import { lerJogadorPonto, lerRotuloPonto, textoPonto, textoPontoSemJogador } from '../src/lib/ponto-sumula'

assert.deepEqual(opcoesDeOrigem({ eraSacando: true, camisaSacador: '7' }).map((o) => o.rotulo), ['Saque', 'Ataque', 'Bloqueio'])
assert.deepEqual(opcoesDeOrigem({ eraSacando: false, camisaSacador: '7' }).map((o) => o.rotulo), ['Ataque', 'Bloqueio'])
assert.deepEqual(opcoesDeOrigem({ eraSacando: true, camisaSacador: '' }).map((o) => o.rotulo), ['Ataque', 'Bloqueio'])
assert.equal(origemPrecisaEscolherAtleta('ace'), false)
assert.equal(origemPrecisaEscolherAtleta('attack'), true)
assert.equal(origemPrecisaEscolherAtleta('block'), true)

type Ev = { id: string; type: string; text: string; time: string; set: number; score: string; jogadorId?: number }
const coletivo: Ev = { id: 'a', type: 'point', text: textoPontoSemJogador('Time A'), time: '10:00', set: 1, score: '1x0' }
const outro: Ev = { id: 'b', type: 'anotacao', text: 'Troca de saque', time: '10:00', set: 1, score: '1x0' }
const lista = [outro, coletivo]
assert.equal(podeAtribuir(coletivo), true)
assert.equal(podeAtribuir(outro), false)
assert.equal(podeAtribuir(undefined), false)

const r = atribuirPontoAoEvento(lista, 'a', { origem: 'attack', equipe: 'Time A', camisa: '10', jogador: 'João Silva', jogadorId: 5 })
assert.equal(r.alterado, true)
const novo = r.eventos.find((e) => e.id === 'a')!
assert.equal(novo.type, 'attack')
assert.equal(novo.jogadorId, 5)
assert.equal(novo.score, '1x0')
assert.equal(lerRotuloPonto(novo.text), '+1 Ponto de Ataque')
assert.equal(lerJogadorPonto(novo.text), 'João Silva')
assert.equal(r.eventos.find((e) => e.id === 'b'), outro)
assert.equal(lista[1].type, 'point', 'não muta a lista original')

// Já atribuído, ausente ou outro tipo: nada muda.
const jaAtribuido = { id: 'c', type: 'ace', text: textoPonto('ace', 'Time A', '7', 'Pedro'), time: '', set: 1, score: '' }
assert.equal(atribuirPontoAoEvento([jaAtribuido], 'c', { origem: 'block', equipe: 'Time A', camisa: '4', jogador: 'X' }).alterado, false)
assert.equal(atribuirPontoAoEvento(lista, 'zzz', { origem: 'block', equipe: 'Time A', camisa: '4', jogador: 'X' }).alterado, false)
assert.equal(atribuirPontoAoEvento(lista, 'b', { origem: 'block', equipe: 'Time A', camisa: '4', jogador: 'X' }).alterado, false)
console.log('atribuicao-ponto ok')
