import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { normalizarPartidaPublica } from '../src/lib/partida-publica'
import {
  aplicarVagas,
  encontrarPartidaDaVaga,
  lerOrigemVaga,
  MENSAGEM_SUMULA_SEM_TIMES,
  rotuloDoLado,
  rotuloValido,
  sugerirVagasSemifinal,
  timesDefinidos,
  type JogoVaga,
} from '../src/lib/vaga-a-definir'

assert.deepEqual(lerOrigemVaga('1º Grupo A'), { tipo: 'grupo', posicao: 1, grupo: 'Grupo A' })
assert.deepEqual(lerOrigemVaga('2º Grupo B'), { tipo: 'grupo', posicao: 2, grupo: 'Grupo B' })
assert.deepEqual(lerOrigemVaga('Vencedor Semi 1'), { tipo: 'vencedor', rodada: 1 })
assert.deepEqual(lerOrigemVaga('Perdedor Semi 2'), { tipo: 'perdedor', rodada: 2 })
assert.equal(lerOrigemVaga('campeão'), null)
assert.equal(rotuloValido('  1º   Grupo A '), '1º Grupo A')
assert.equal(MENSAGEM_SUMULA_SEM_TIMES.includes('não pode iniciar'), true)
assert.equal(timesDefinidos({ equipeAId: null, equipeBId: 2 }), false)
assert.equal(timesDefinidos({ equipeAId: 1, equipeBId: 2 }), true)

const grupos = [
  { nome: 'Grupo A', classificados: [10, 11] },
  { nome: 'Grupo B', classificados: [20, 21] },
]
const semi: JogoVaga = {
  id: 41,
  fase: 'SEMIFINAL',
  rodada: 1,
  status: 'AGENDADA',
  equipeAId: null,
  equipeBId: null,
  origemVagaA: '1º Grupo A',
  origemVagaB: '2º Grupo B',
  setsPorA: null,
  setsPorB: null,
  vencedorId: null,
}

assert.deepEqual(aplicarVagas({ jogos: [semi], gruposEncerrados: false, grupos }), [])
assert.deepEqual(aplicarVagas({ jogos: [semi], gruposEncerrados: true, grupos }), [
  { id: 41, equipeAId: 10, equipeBId: 21 },
])

const semiPronta: JogoVaga = {
  ...semi,
  id: 41,
  status: 'ENCERRADA',
  equipeAId: 10,
  equipeBId: 21,
  setsPorA: 2,
  setsPorB: 1,
  vencedorId: 10,
}
const semi2: JogoVaga = {
  id: 42,
  fase: 'SEMIFINAL',
  rodada: 2,
  status: 'ENCERRADA',
  equipeAId: 20,
  equipeBId: 11,
  origemVagaA: '1º Grupo B',
  origemVagaB: '2º Grupo A',
  setsPorA: 0,
  setsPorB: 2,
  vencedorId: 11,
}
const final: JogoVaga = {
  id: 43,
  fase: 'FINAL',
  rodada: 1,
  status: 'AGENDADA',
  equipeAId: null,
  equipeBId: null,
  origemVagaA: 'Vencedor Semi 1',
  origemVagaB: 'Vencedor Semi 2',
  setsPorA: null,
  setsPorB: null,
  vencedorId: null,
}
const terceiro: JogoVaga = {
  id: 44,
  fase: 'TERCEIRO_LUGAR',
  rodada: 1,
  status: 'AGENDADA',
  equipeAId: null,
  equipeBId: null,
  origemVagaA: 'Perdedor Semi 1',
  origemVagaB: 'Perdedor Semi 2',
  setsPorA: null,
  setsPorB: null,
  vencedorId: null,
}

const preenchidos = aplicarVagas({
  jogos: [semiPronta, semi2, final, terceiro],
  gruposEncerrados: true,
  grupos,
})
assert.deepEqual(preenchidos.find((item) => item.id === 43), { id: 43, equipeAId: 10, equipeBId: 11 })
assert.deepEqual(preenchidos.find((item) => item.id === 44), { id: 44, equipeAId: 21, equipeBId: 20 })
assert.equal(preenchidos.some((item) => item.id === 41), false)

const travada: JogoVaga = { ...semi, equipeAId: 99, origemVagaA: '1º Grupo A' }
const travadaPatch = aplicarVagas({ jogos: [travada], gruposEncerrados: true, grupos })
assert.equal(travadaPatch[0]?.equipeAId, undefined)
assert.equal(travadaPatch[0]?.equipeBId, 21)

const sugestao = sugerirVagasSemifinal(['Grupo A', 'Grupo B'], true)
assert.equal(sugestao.length, 4)
assert.equal(sugestao[0].origemVagaA, '1º Grupo A')
assert.equal(sugestao[2].origemVagaB, 'Vencedor Semi 2')
assert.equal(sugestao[3].fase, 'TERCEIRO_LUGAR')

assert.equal(normalizarPartidaPublica({ id: 7, equipeA: null, equipeB: null, rodada: 1, status: 'AGENDADA' }), null)
const publica = normalizarPartidaPublica({
  id: 8,
  ligaId: 3,
  rodada: 1,
  fase: 'SEMIFINAL',
  status: 'AGENDADA',
  dataHora: '2026-10-18T21:00:00',
  localNome: 'Quadra 1',
  equipeA: null,
  equipeB: null,
  origemVagaA: '1º Grupo A',
  origemVagaB: '2º Grupo B',
  sets: [],
})
assert.equal(publica?.equipeA?.vaga, true)
assert.equal(publica?.equipeA?.nome, '1º Grupo A')
assert.equal(publica?.equipeB?.nome, '2º Grupo B')
assert.equal(publica?.dataHora, '2026-10-18T21:00:00.000Z')

assert.equal(rotuloDoLado(null, 'Vencedor Semi 1'), 'Vencedor Semi 1')
assert.equal(rotuloDoLado({ nome: 'Alpha' }, 'Vencedor Semi 1'), 'Alpha')
assert.equal(rotuloDoLado(null, null), 'Equipe')

const categoria = '5ba7d064-1813-46a0-b1fd-f42137f26dcf'
const jogosSql = [
  { id: 1098, fase: 'SEMIFINAL', rodada: 1, categoriaCampeonatoId: categoria },
  { id: 1099, fase: 'SEMIFINAL', rodada: 2, categoriaCampeonatoId: categoria },
  { id: 1097, fase: 'FINAL', rodada: 1, categoriaCampeonatoId: categoria },
]
assert.equal(encontrarPartidaDaVaga(jogosSql, 'SEMIFINAL', 1, null)?.id, 1098)
assert.equal(encontrarPartidaDaVaga(jogosSql, 'FINAL', 1, categoria)?.id, 1097)
assert.equal(encontrarPartidaDaVaga([
  ...jogosSql,
  { id: 2098, fase: 'SEMIFINAL', rodada: 1, categoriaCampeonatoId: '7ec8a218-d7d0-4cab-9ab4-15778adf3519' },
], 'SEMIFINAL', 1, null), null)

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010142000_vaga_a_definir.sql'), 'utf8')
assert.match(sql, /alter column "equipeAId" drop not null/i)
assert.match(sql, /alter column "equipeBId" drop not null/i)
assert.match(sql, /add column if not exists "origemVagaA"/i)
assert.match(sql, /add column if not exists "origemVagaB"/i)
assert.match(sql, /Partida_vaga_definida_check/)
assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+anon\b/i)
assert.doesNotMatch(sql, /\b(delete|truncate|drop table)\b/i)

console.log('vaga a definir ok')
