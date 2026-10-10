import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { regrasParaFase, validateCategoryResult } from '../src/lib/category-match-rules'
import { resumirChavePublica } from '../src/lib/chave-publica'
import { setsDaFase } from '../src/lib/sets-por-fase'

const base = {
  setsPorPartida: 3,
  pontosPorSet: 25,
  tieBreakUltimoSet: true,
  pontosUltimoSet: 15,
  terceiroSetObrigatorio: true,
  setsPorPartidaFinal: 5,
}

const placar = (scores: number[][]) => scores.map(([pontosA, pontosB], index) => ({ numero: index + 1, pontosA, pontosB }))

const final = regrasParaFase(base, 'FINAL')
assert.equal(final.setsPorPartida, 5)
assert.equal(final.terceiroSetObrigatorio, false)
assert.equal(validateCategoryResult(placar([[25, 20], [25, 23], [25, 22]]), final), null, 'melhor de 5 encerra em 3×0')
assert.equal(validateCategoryResult(placar([[25, 20], [25, 23], [20, 25], [23, 25], [15, 10]]), final), null, '3×2 com tie-break no 5º')
assert.match(validateCategoryResult(placar([[25, 20], [25, 23], [20, 25], [15, 13]]), final) ?? '', /set 4/)
assert.match(validateCategoryResult(placar([[25, 20], [25, 23], [20, 25], [23, 25], [15, 13], [15, 10]]), final) ?? '', /Quantidade de sets inválida/)

const grupos = regrasParaFase(base, 'GRUPOS')
assert.equal(grupos.setsPorPartida, 3)
assert.equal(grupos.terceiroSetObrigatorio, true)
assert.match(validateCategoryResult(placar([[25, 20], [25, 23], [20, 25], [23, 25]]), grupos) ?? '', /Quantidade de sets inválida/)
assert.match(validateCategoryResult(placar([[25, 20], [25, 23]]), grupos) ?? '', /concluiu/)

const semiHerdada = regrasParaFase(base, 'SEMIFINAL')
assert.equal(semiHerdada.setsPorPartida, 3)
const semi = regrasParaFase({ ...base, setsPorPartidaSemifinal: 5, terceiroSetObrigatorio: false }, 'SEMIFINAL')
assert.equal(semi.setsPorPartida, 5)
assert.equal(validateCategoryResult(placar([[25, 20], [25, 23], [25, 22]]), semi), null, 'semifinal melhor de 5 encerra em 3×0')

const terceiro = regrasParaFase({ ...base, setsPorPartidaTerceiroLugar: 1, terceiroSetObrigatorio: false }, 'TERCEIRO_LUGAR')
assert.equal(terceiro.setsPorPartida, 1)
assert.equal(validateCategoryResult(placar([[25, 20]]), terceiro), null)
assert.match(validateCategoryResult(placar([[25, 20], [25, 23]]), terceiro) ?? '', /Quantidade de sets inválida/)

assert.equal(setsDaFase({ setsPorPartida: 3, setsPorPartidaFinal: null }, 'FINAL'), 3)
assert.equal(setsDaFase({ setsPorPartida: 3, setsPorPartidaFinal: 0 }, 'FINAL'), 3)
assert.equal(setsDaFase({ setsPorPartida: 3, setsPorPartidaFinal: 9 }, 'FINAL'), 3)
assert.equal(setsDaFase({ setsPorPartida: 3, setsPorPartidaFinal: 5 }, 'QUARTAS'), 3)
assert.equal(setsDaFase({ setsPorPartida: 3 }, 'final'), 3)

const resumo = resumirChavePublica([
  { fase: 'SEMIFINAL', slots: [{ partida: null }] },
  { fase: 'FINAL', slots: [{ partida: { status: 'ENCERRADA', equipeA: { nome: 'A' }, equipeB: { nome: 'B' }, setsPorA: 3, setsPorB: 2, sets: [] } }] },
], { partida: { status: 'ENCERRADA', equipeA: { nome: 'C' }, equipeB: { nome: 'D' }, setsPorA: 2, setsPorB: 0, sets: [] } })
assert.equal(resumo.temMataMata, true)
assert.equal(resumo.final?.partida?.setsPorA, 3)
assert.equal(resumo.terceiro?.partida?.setsPorB, 0)
assert.equal(resumirChavePublica([], null).temMataMata, false)
assert.equal(resumirChavePublica([{ fase: 'SEMIFINAL', slots: [] }], null).final, null)

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010190000_sets_por_fase_mata_mata.sql'), 'utf8')
assert.match(sql, /add column if not exists "setsPorPartidaFinal"/)
assert.match(sql, /add column if not exists "setsPorPartidaSemifinal"/)
assert.match(sql, /add column if not exists "setsPorPartidaTerceiroLugar"/)
assert.match(sql, /Liga_sets_por_fase_check/)
assert.match(sql, /CategoriaConfiguracao_sets_por_fase_check/)
assert.match(sql, /setsPorPartidaFinal','setsPorPartidaSemifinal','setsPorPartidaTerceiroLugar/)
assert.match(sql, /p_patch - 'setsPorPartidaFinal' - 'setsPorPartidaSemifinal' - 'setsPorPartidaTerceiroLugar'/)
assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+(anon|authenticated)\b/i)
assert.match(sql, /grant execute on function public.salvar_configuracao_categoria[\s\S]*to service_role/)

console.log('sets por fase ok')
