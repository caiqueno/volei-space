import assert from 'node:assert/strict'
import fs from 'node:fs'
import { montarFonteDeRegras, regrasParaFase, regrasVisiveis } from '../src/lib/category-match-rules'
import { calcularClassificacao } from '../src/lib/classificacao'
import { rpcAusente } from '../src/lib/rpc-ausente'

const fonte = montarFonteDeRegras({
  liga: {
    setsPorPartida: 5,
    pontosPorSet: 25,
    tieBreakUltimoSet: false,
    terceiroSetObrigatorio: true,
    setsPorPartidaFinal: 1,
  },
  categoria: {
    setsPorPartida: 3,
    pontosPorSet: 21,
    tieBreakUltimoSet: true,
    pontosUltimoSet: 15,
    terceiroSetObrigatorio: true,
    setsFormato: 'MELHOR_DE',
    setsPorPartidaFinal: 5,
  },
})
const grupos = regrasParaFase(fonte, 'GRUPOS')
assert.equal(grupos.setsPorPartida, 3)
assert.equal(grupos.pontosPorSet, 21)
assert.equal(grupos.tieBreakUltimoSet, true)
assert.equal(grupos.pontosUltimoSet, 15)
assert.equal(grupos.terceiroSetObrigatorio, true)
assert.equal(grupos.setsPorPartidaFinal, 5, 'a fase da categoria não herda o valor da Liga')

const tela = regrasVisiveis(fonte, 'GRUPOS')
assert.equal(tela.setsPerMatch, 3)
assert.equal(tela.setsToWin, 3, 'terceiro set obrigatório joga os três sets')
assert.equal(tela.lastSetPoints, 15)
assert.equal(tela.pointsPerSet, 21)
assert.equal(tela.exigeTodosOsSets, true)

const semCategoria = regrasParaFase(montarFonteDeRegras({
  liga: {
    setsPorPartida: 5,
    pontosPorSet: 25,
    tieBreakUltimoSet: false,
    pontosUltimoSet: 12,
    terceiroSetObrigatorio: true,
  },
}), 'GRUPOS')
assert.equal(semCategoria.terceiroSetObrigatorio, false, 'Liga não tem terceiro set obrigatório')
assert.equal(semCategoria.tieBreakUltimoSet, false, 'o default da Liga continua desligado')
assert.equal(semCategoria.pontosPorSet, 25)
assert.equal(semCategoria.setsPorPartida, 5)

const finalDaCategoria = regrasVisiveis(montarFonteDeRegras({
  categoria: {
    setsPorPartida: 3,
    pontosPorSet: 25,
    tieBreakUltimoSet: true,
    pontosUltimoSet: 15,
    terceiroSetObrigatorio: true,
    setsPorPartidaFinal: 5,
  },
}), 'FINAL')
assert.equal(finalDaCategoria.setsPerMatch, 5)
assert.equal(finalDaCategoria.setsToWin, 3)
assert.equal(finalDaCategoria.lastSetPoints, 15)
assert.equal(finalDaCategoria.exigeTodosOsSets, false)

const times = [
  { equipeId: 1, categoriaCampeonatoId: 'cat', categoria: 'Misto' },
  { equipeId: 2, categoriaCampeonatoId: 'cat', categoria: 'Misto' },
]
const aoVivo = {
  equipeAId: 1,
  equipeBId: 2,
  fase: 'GRUPOS',
  status: 'EM_ANDAMENTO',
  categoriaCampeonatoId: 'cat',
  sets: [{ numero: 3, pontosA: 15, pontosB: 13 }],
}
const comTie = calcularClassificacao({
  times,
  partidas: [aoVivo],
  regras: { cat: { set: { setsPorPartida: 3, pontosPorSet: 25, tieBreakUltimoSet: true, pontosUltimoSet: 15, diferencaMinimaSet: 2 } } },
})
assert.equal(comTie.find((linha) => linha.equipeId === 1)?.setsPro, 1, 'tie-break da categoria fecha 15x13')
assert.equal(comTie.find((linha) => linha.equipeId === 1)?.jogos, 0)
const semTie = calcularClassificacao({
  times,
  partidas: [aoVivo],
  regras: { cat: { set: { setsPorPartida: 3, pontosPorSet: 25, tieBreakUltimoSet: false, pontosUltimoSet: 15, diferencaMinimaSet: 2 } } },
})
assert.equal(semTie.find((linha) => linha.equipeId === 1)?.setsPro, 0, 'sem tie-break, 15x13 não fecha o set de 25')

const sql = fs.readFileSync('supabase/migrations/20261010137000_sumula_transacional.sql', 'utf8')
assert.match(sql, /perform pg_advisory_xact_lock\(v_liga_id\);/)
assert.match(sql, /perform pg_advisory_xact_lock\(v_liga_id, p_partida_id\);/)
assert.match(sql, /perform pg_advisory_xact_lock\(p_liga_id\);/)
assert.doesNotMatch(sql, /create or replace function public\.recalcular_classificacao_liga/i)
assert.match(sql, /grant execute on function public\.gravar_sumula_partida/)
assert.match(sql, /grant execute on function public\.gravar_classificacao_calculada/)
assert.doesNotMatch(sql, /\bto\s+anon\b/i)
assert.doesNotMatch(sql, /\bto\s+authenticated\b/i)

assert.equal(rpcAusente({ code: 'PGRST202', message: 'Could not find the function gravar_sumula_partida' }), true)
assert.equal(rpcAusente({ code: '23503', message: 'insert or update on table violates foreign key' }), false)

console.log('regras da súmula ok')
