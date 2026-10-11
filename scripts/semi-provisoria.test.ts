import assert from 'node:assert/strict'
import { comTimesProvisorios, type GrupoProvisorio, type LadoChave } from '../src/lib/semi-provisoria'

const grupos: GrupoProvisorio[] = [
  {
    nome: 'Grupo A',
    vagas: 2,
    linhas: [
      { posicao: 1, equipeId: 10, equipe: 'Angels', logoUrl: '/a.png', corHex: '#111111' },
      { posicao: 2, equipeId: 11, equipe: 'Tayo', logoUrl: null, corHex: '#222222' },
      { posicao: 3, equipeId: 12, equipe: 'Fora', logoUrl: null, corHex: null },
    ],
  },
  {
    nome: 'Grupo B',
    vagas: 2,
    linhas: [
      { posicao: 1, equipeId: 20, equipe: 'Black', logoUrl: '/b.png', corHex: '#333333' },
      { posicao: 2, equipeId: 21, equipe: 'Luz', logoUrl: '/c.png', corHex: '#444444' },
    ],
  },
]

function lado(nome: string, id = 0): LadoChave {
  return { id, nome, corHex: null, logoUrl: null, vaga: id <= 0 }
}

function chave(semis: Array<{ rodada: number; a: LadoChave; b: LadoChave }>, extra: Array<{ fase: string; rodada: number; a: LadoChave; b: LadoChave }> = []) {
  return [
    {
      fase: 'SEMIFINAL',
      slots: semis.map((jogo) => ({
        rodada: jogo.rodada,
        partida: { id: jogo.rodada, equipeA: jogo.a, equipeB: jogo.b, status: 'AGENDADA' },
      })),
    },
    ...extra.map((jogo) => ({
      fase: jogo.fase,
      slots: [{ rodada: jogo.rodada, partida: { id: 90, equipeA: jogo.a, equipeB: jogo.b, status: 'AGENDADA' } }],
    })),
  ]
}

const definido = comTimesProvisorios(chave([
  { rodada: 1, a: lado('A definir'), b: lado('A definir') },
  { rodada: 2, a: lado('A definir'), b: lado('A definir') },
]), grupos)

assert.equal(definido[0].slots[0].partida?.equipeA.nome, 'Angels')
assert.equal(definido[0].slots[0].partida?.equipeA.provisorio, true)
assert.equal(definido[0].slots[0].partida?.equipeA.origem, '1º Grupo A')
assert.equal(definido[0].slots[0].partida?.equipeA.logoUrl, '/a.png')
assert.equal(definido[0].slots[0].partida?.equipeB.nome, 'Luz')
assert.equal(definido[0].slots[0].partida?.equipeB.origem, '2º Grupo B')
assert.equal(definido[0].slots[1].partida?.equipeA.nome, 'Black')
assert.equal(definido[0].slots[1].partida?.equipeA.origem, '1º Grupo B')
assert.equal(definido[0].slots[1].partida?.equipeB.nome, 'Tayo')
assert.equal(definido[0].slots[1].partida?.equipeB.origem, '2º Grupo A')
assert.equal(definido[0].slots[1].partida?.equipeB.logoUrl, null)

const porOrigem = comTimesProvisorios(chave([
  { rodada: 1, a: lado('1º Grupo A'), b: lado('2º Grupo B') },
  { rodada: 2, a: lado('1º grupo b'), b: lado('2º Grupo A') },
]), grupos)
assert.equal(porOrigem[0].slots[0].partida?.equipeA.id, 10)
assert.equal(porOrigem[0].slots[0].partida?.equipeB.id, 21)
assert.equal(porOrigem[0].slots[1].partida?.equipeA.id, 20)
assert.equal(porOrigem[0].slots[1].partida?.equipeB.id, 11)

const real = lado('Angels', 99)
real.vaga = false
real.corHex = '#abcdef'
const misto = comTimesProvisorios(chave([
  { rodada: 1, a: real, b: lado('2º Grupo B') },
]), grupos)
assert.equal(misto[0].slots[0].partida?.equipeA.id, 99)
assert.equal(misto[0].slots[0].partida?.equipeA.provisorio, undefined)
assert.equal(misto[0].slots[0].partida?.equipeB.nome, 'Luz')
assert.equal(misto[0].slots[0].partida?.equipeB.provisorio, true)

const fechado = comTimesProvisorios(chave([
  { rodada: 1, a: lado('Angels', 10), b: lado('Luz', 21) },
]), grupos)
assert.equal(fechado[0].slots[0].partida?.equipeA.provisorio, undefined)
assert.equal(fechado[0].slots[0].partida?.equipeB.nome, 'Luz')

const final = comTimesProvisorios(chave([], [
  { fase: 'FINAL', rodada: 1, a: lado('A definir'), b: lado('Vencedor Semi 2') },
  { fase: 'TERCEIRO_LUGAR', rodada: 1, a: lado('A definir'), b: lado('A definir') },
]), grupos)
assert.equal(final[1].slots[0].partida?.equipeA.nome, 'A definir')
assert.equal(final[2].slots[0].partida?.equipeB.nome, 'A definir')

const poucasVagas: GrupoProvisorio[] = grupos.map((grupo) => ({ ...grupo, vagas: 1 }))
const semSegundo = comTimesProvisorios(chave([
  { rodada: 1, a: lado('A definir'), b: lado('2º Grupo B') },
  { rodada: 2, a: lado('1º Grupo B'), b: lado('2º Grupo A') },
]), poucasVagas)
assert.equal(semSegundo[0].slots[0].partida?.equipeA.nome, 'A definir')
assert.equal(semSegundo[0].slots[0].partida?.equipeB.nome, '2º Grupo B')
assert.equal(semSegundo[0].slots[1].partida?.equipeA.nome, 'Black')
assert.equal(semSegundo[0].slots[1].partida?.equipeB.nome, '2º Grupo A')

const original = chave([
  { rodada: 1, a: lado('A definir'), b: lado('A definir') },
])
comTimesProvisorios(original, grupos)
assert.equal(original[0].slots[0].partida?.equipeA.nome, 'A definir')
assert.equal(original[0].slots[0].partida?.equipeA.id, 0)

const volta = comTimesProvisorios(chave([
  { rodada: 1001, a: lado('A definir'), b: lado('A definir') },
]), grupos)
assert.equal(volta[0].slots[0].partida?.equipeA.nome, 'Luz')
assert.equal(volta[0].slots[0].partida?.equipeB.nome, 'Angels')

const custom = comTimesProvisorios(chave([
  { rodada: 1, a: lado('1º Grupo A'), b: lado('1º Grupo B') },
]), grupos)
assert.equal(custom[0].slots[0].partida?.equipeA.id, 10)
assert.equal(custom[0].slots[0].partida?.equipeB.id, 20)

const mesmo = lado('Angels', 10)
mesmo.vaga = false
const duplicado = comTimesProvisorios(chave([
  { rodada: 1, a: mesmo, b: lado('1º Grupo A') },
]), grupos)
assert.equal(duplicado[0].slots[0].partida?.equipeB.nome, '1º Grupo A')
assert.equal(duplicado[0].slots[0].partida?.equipeB.provisorio, undefined)
