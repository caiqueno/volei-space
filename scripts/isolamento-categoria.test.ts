import assert from 'node:assert/strict'
import {
  escolherCategoria,
  confrontoRepetidoNaCategoria,
  equipesDaCategoria,
  escopoDaGeracao,
  lerIdCategoria,
  paresDentroDosGrupos,
  partidaForaDaCategoria,
  partidasDeGrupoDaCategoria,
  regeneracaoBloqueada,
} from '../src/lib/isolamento-categoria'

const feminino = '11111111-1111-4111-8111-111111111111'
const masculino = '22222222-2222-4222-8222-222222222222'

assert.deepEqual(lerIdCategoria(''), { id: null })
assert.deepEqual(lerIdCategoria('nao-uuid'), { erro: 'Selecione uma categoria do campeonato.' })
assert.deepEqual(lerIdCategoria(feminino), { id: feminino })

assert.equal(escolherCategoria(null, [{ id: feminino }, { id: masculino }]), feminino)
assert.equal(escolherCategoria(masculino, [{ id: feminino }, { id: masculino }]), masculino)
assert.equal(escolherCategoria('lixo', [{ id: feminino }]), feminino)
assert.equal(escolherCategoria(feminino, []), null)

const equipes = [
  { id: 1, categoriaCampeonatoId: feminino },
  { id: 2, categoriaCampeonatoId: feminino },
  { id: 3, categoriaCampeonatoId: masculino },
]
assert.deepEqual(equipesDaCategoria(equipes, feminino).map((equipe) => equipe.id), [1, 2])
assert.equal(escopoDaGeracao(equipes, null).tipo, 'erro')
assert.deepEqual(escopoDaGeracao(equipes, feminino), { tipo: 'categoria', id: feminino })
assert.deepEqual(escopoDaGeracao([{ id: 9, categoriaCampeonatoId: null }], null), { tipo: 'legado' })
assert.deepEqual(escopoDaGeracao([{ id: 1, categoriaCampeonatoId: feminino }, { id: 2, categoriaCampeonatoId: feminino }], null), { tipo: 'categoria', id: feminino })

const partidas = [
  { id: 10, categoriaCampeonatoId: feminino, fase: 'GRUPOS', grupoId: 1, status: 'AGENDADA' },
  { id: 11, categoriaCampeonatoId: feminino, fase: 'FINAL', grupoId: null, status: 'ENCERRADA' },
  { id: 12, categoriaCampeonatoId: masculino, fase: 'GRUPOS', grupoId: 2, status: 'EM_ANDAMENTO' },
  { id: 13, categoriaCampeonatoId: masculino, fase: 'GRUPOS', grupoId: 2, status: 'AGENDADA' },
]
assert.deepEqual(partidasDeGrupoDaCategoria(partidas, feminino).map((partida) => partida.id), [10])
assert.equal(regeneracaoBloqueada(partidas, feminino), false)
assert.equal(regeneracaoBloqueada(partidas, masculino), true)
assert.equal(partidaForaDaCategoria([{ categoriaCampeonatoId: feminino }, { categoriaCampeonatoId: masculino }], feminino), true)
assert.equal(partidaForaDaCategoria([{ categoriaCampeonatoId: feminino }], feminino), false)

const pares = paresDentroDosGrupos(equipes)
assert.deepEqual(pares.map((par) => [par.a.id, par.b.id]), [[1, 2]])
assert.ok(pares.every((par) => par.a.categoriaCampeonatoId === par.b.categoriaCampeonatoId))

const finais = [
  { categoriaCampeonatoId: feminino, fase: 'FINAL', rodada: 1 },
  { categoriaCampeonatoId: masculino, fase: 'FINAL', rodada: 1 },
]
assert.equal(confrontoRepetidoNaCategoria(finais, feminino, 'FINAL', 1), true)
assert.equal(confrontoRepetidoNaCategoria(finais, '33333333-3333-4333-8333-333333333333', 'FINAL', 1), false)

console.log('isolamento por categoria: grupos, pares e chave não cruzam categoria')
