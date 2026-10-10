import assert from 'node:assert/strict'
import { montarConfrontos } from '../src/lib/rodadas'
import {
  alinharGrupos,
  cruzarSemifinais,
  distribuirEquipes,
  filtrarElenco,
  mensagemConfrontoForaDoGrupo,
  mensagemParesForaDoGrupo,
  quantidadeInicialDeGrupos,
} from '../src/lib/grupos-fase'
import { calcularClassificacao, classificarPorGrupos, type PartidaClassificacao } from '../src/lib/classificacao'

const dez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const grupos = distribuirEquipes(dez, 2)
assert.equal(grupos.length, 2)
assert.deepEqual(grupos[0].equipeIds, [1, 3, 5, 7, 9])
assert.deepEqual(grupos[1].equipeIds, [2, 4, 6, 8, 10])

const pares = grupos.flatMap((grupo) => (
  montarConfrontos(grupo.equipeIds.map((id) => ({ id }))).map((jogo) => ({
    equipeAId: jogo.a.id,
    equipeBId: jogo.b.id,
    grupo: grupo.nome,
  }))
))
assert.equal(pares.length, 20)
assert.equal(pares.filter((par) => par.grupo === 'Grupo A').length, 10)
assert.equal(mensagemParesForaDoGrupo(grupos, pares), null)
assert.equal(mensagemParesForaDoGrupo(grupos, [{ equipeAId: 1, equipeBId: 2 }]), 'Na fase de grupos, o jogo só pode ser entre equipes do mesmo grupo.')

const vinculos = grupos.flatMap((grupo, indice) => grupo.equipeIds.map((equipeId) => ({ equipeId, grupoId: indice + 1 })))
assert.equal(mensagemConfrontoForaDoGrupo({ fase: 'GRUPOS', equipeAId: 1, equipeBId: 3, vinculos }), null)
assert.equal(mensagemConfrontoForaDoGrupo({ fase: 'GERAL', equipeAId: 1, equipeBId: 2, vinculos }), 'Na fase de grupos, o jogo só pode ser entre equipes do mesmo grupo.')
assert.equal(mensagemConfrontoForaDoGrupo({ fase: 'SEMIFINAL', equipeAId: 1, equipeBId: 2, vinculos }), null)
assert.equal(mensagemConfrontoForaDoGrupo({ fase: 'GRUPOS', equipeAId: 1, equipeBId: 99, vinculos }), 'Na fase de grupos, o jogo só pode ser entre equipes do mesmo grupo.')
assert.equal(mensagemConfrontoForaDoGrupo({ fase: 'GERAL', equipeAId: 1, equipeBId: 2, vinculos: [] }), null)

const alinhados = alinharGrupos({
  quantidade: 2,
  salvos: [{ nome: 'Grupo A', equipeIds: dez }],
  equipeIds: dez,
})
assert.equal(alinhados.length, 2)
assert.equal(alinhados[0].equipeIds.length, 5)
assert.equal(alinhados[1].equipeIds.length, 5)
assert.equal(new Set([...alinhados[0].equipeIds, ...alinhados[1].equipeIds]).size, 10)

const preservados = alinharGrupos({ quantidade: 2, salvos: grupos, equipeIds: dez })
assert.deepEqual(preservados, grupos)

assert.equal(quantidadeInicialDeGrupos({ quantidadeSalva: null, formato: 'GRUPOS_MATA_MATA', equipes: 10, gruposExistentes: 0 }), 2)
assert.equal(quantidadeInicialDeGrupos({ quantidadeSalva: 2, formato: 'PONTOS_CORRIDOS', equipes: 10, gruposExistentes: 1 }), 2)
assert.equal(quantidadeInicialDeGrupos({ quantidadeSalva: null, formato: 'PONTOS_CORRIDOS', equipes: 10, gruposExistentes: 0 }), 1)

const linhas = [1, 2, 3, 4].map((equipeId) => ({
  equipeId,
  categoriaCampeonatoId: 'cat',
  categoria: 'MISTO',
  pontos: equipeId === 1 || equipeId === 3 ? 3 : 0,
  jogos: 1,
  vitorias: equipeId === 1 || equipeId === 3 ? 1 : 0,
  derrotas: equipeId === 1 || equipeId === 3 ? 0 : 1,
  setsPro: equipeId === 1 || equipeId === 3 ? 2 : 0,
  setsContra: equipeId === 1 || equipeId === 3 ? 0 : 2,
  pontosPro: 0,
  pontosContra: 0,
}))
const partidas: PartidaClassificacao[] = [
  { equipeAId: 1, equipeBId: 2, setsPorA: 2, setsPorB: 0, pontosPorA: 42, pontosPorB: 30, status: 'ENCERRADA', fase: 'GRUPOS' },
  { equipeAId: 3, equipeBId: 4, setsPorA: 2, setsPorB: 1, pontosPorA: 40, pontosPorB: 38, status: 'ENCERRADA', fase: 'GRUPOS' },
  { equipeAId: 1, equipeBId: 3, setsPorA: 2, setsPorB: 0, pontosPorA: 42, pontosPorB: 20, status: 'ENCERRADA', fase: 'GRUPOS' },
]
const tabelas = classificarPorGrupos({
  linhas,
  partidas,
  grupos: [
    { id: 1, nome: 'Grupo A', equipeIds: [1, 3], automaticLimit: 2 },
    { id: 2, nome: 'Grupo B', equipeIds: [2, 4], automaticLimit: 2 },
  ],
})
assert.deepEqual(tabelas[0].linhas.map((linha) => linha.equipeId), [1, 3])
assert.equal(tabelas[0].linhas[0].posicao, 1)
assert.equal(tabelas[0].linhas[1].posicao, 2)

const cruzamento = cruzarSemifinais(tabelas.map((grupo) => ({
  nome: grupo.nome,
  classificados: grupo.linhas.slice(0, 2).map((linha) => linha.equipeId),
})))
assert.deepEqual(cruzamento, [
  { fase: 'SEMIFINAL', rodada: 1, equipeAId: 1, equipeBId: 4 },
  { fase: 'SEMIFINAL', rodada: 2, equipeAId: 2, equipeBId: 3 },
])
assert.equal(cruzarSemifinais([{ nome: 'Grupo A', classificados: [1] }]), null)

const geral = calcularClassificacao({
  times: linhas.map((linha) => ({ equipeId: linha.equipeId, categoriaCampeonatoId: linha.categoriaCampeonatoId, categoria: linha.categoria })),
  partidas,
})
assert.deepEqual(geral.map((linha) => linha.equipeId), [1, 3, 4, 2])

const elenco = filtrarElenco([
  { equipeId: 1, equipe: 'Alfa', grupo: 'Grupo A', jogadorId: 10, jogador: 'Ana Souza', numero: 7 },
  { equipeId: 2, equipe: 'Beta', grupo: 'Grupo B', jogadorId: 11, jogador: 'Bruno Lima', numero: 4 },
], 'ana')
assert.equal(elenco.length, 1)
assert.equal(elenco[0].jogador, 'Ana Souza')
assert.equal(filtrarElenco(elenco, '9').length, 0)

console.log('grupos-fase.test.ts ok')
