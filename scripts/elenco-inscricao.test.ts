import assert from 'node:assert/strict'
import { interpretarListaColada, motivoBloqueioConcluir, resumirElenco, separarNovosAtletas } from '../src/lib/elenco-inscricao'

const lista = interpretarListaColada([
  'Maria Souza, 10',
  '7 - Ana Lima',
  '#12 Bia Santos',
  'Carla Dias 5',
  'Dani Alves;3',
  '1. Eva Rocha',
  '- Fernanda Costa',
  '',
  '99999',
  'Gi 120',
].join('\n'))
assert.deepEqual(lista.atletas.map((a) => [a.nome, a.numero]), [
  ['Maria Souza', '10'], ['Ana Lima', '7'], ['Bia Santos', '12'], ['Carla Dias', '5'], ['Dani Alves', '3'], ['Eva Rocha', ''], ['Fernanda Costa', ''],
])
assert.equal(lista.ignoradas.length, 2)
assert.equal(lista.ignoradas[0].linha, 9)

const crlf = interpretarListaColada('Ana Lima, 7\r\nBia Souza, 08\r\n')
assert.deepEqual(crlf.atletas, [{ nome: 'Ana Lima', numero: '7' }, { nome: 'Bia Souza', numero: '8' }])

const sep = separarNovosAtletas(
  [{ nome: 'ana  lima', numero: '7' }, { nome: 'Nova', numero: '10' }, { nome: 'Outra', numero: '11' }, { nome: 'Outra', numero: '' }],
  [{ nome: 'Ana Lima', numero: 7 }, { nome: 'Fulana', numero: '10' }],
)
assert.deepEqual(sep.repetidos.map((r) => r.motivo), ['Já está no elenco', 'Camisa 10 já usada', 'Já está no elenco'])
assert.deepEqual(sep.novos, [{ nome: 'Outra', numero: '11' }])

assert.equal(resumirElenco(3, 6, 14).situacao, 'abaixo')
assert.equal(resumirElenco(10, 6, 14).texto, '10 atletas · mínimo 6 · máximo 14')
assert.equal(resumirElenco(15, 6, 14).situacao, 'acima')
assert.equal(resumirElenco(1, null, null).situacao, 'ok')
assert.equal(resumirElenco(0, null, null).situacao, 'abaixo')

const base = { nomeEquipe: 'Time', precisaCategoria: false, categoriaEscolhida: true, liderObrigatorio: false, lider: '', total: 6, minimo: 6, maximo: 14 }
assert.equal(motivoBloqueioConcluir(base), null)
assert.equal(motivoBloqueioConcluir({ ...base, total: 4 }), 'Faltam 2 atletas para chegar ao mínimo de 6.')
assert.equal(motivoBloqueioConcluir({ ...base, total: 5 }), 'Faltam 1 atleta para chegar ao mínimo de 6.')
assert.equal(motivoBloqueioConcluir({ ...base, total: 16 }), 'Remova 2 atletas: o máximo é 14.')
assert.equal(motivoBloqueioConcluir({ ...base, total: 0 }), 'Adicione pelo menos 1 atleta para concluir.')
assert.equal(motivoBloqueioConcluir({ ...base, nomeEquipe: ' ' }), 'Informe o nome da equipe para concluir.')
assert.equal(motivoBloqueioConcluir({ ...base, precisaCategoria: true, categoriaEscolhida: false }), 'Escolha o torneio para concluir.')
assert.equal(motivoBloqueioConcluir({ ...base, liderObrigatorio: true }), 'Informe o líder da equipe para concluir.')
console.log('elenco-inscricao ok')
