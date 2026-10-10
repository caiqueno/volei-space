import assert from 'node:assert/strict'
import { validateCategoryProgress, validateCategoryResult, type CategoryMatchRules } from '../src/lib/category-match-rules'

const rules: CategoryMatchRules = { setsPorPartida: 3, pontosPorSet: 21, tieBreakUltimoSet: true, pontosUltimoSet: 15 }
const result = (scores: number[][], config = rules) => validateCategoryResult(scores.map(([pontosA, pontosB], i) => ({ numero: i + 1, pontosA, pontosB })), config)
assert.equal(result([[21, 19], [22, 20]]), null)
assert.ok(result([[21, 20], [21, 19]]))
assert.equal(result([[21, 19], [19, 21], [16, 14]]), null)
assert.equal(result([[21, 19], [21, 19], [15, 13]], { ...rules, terceiroSetObrigatorio: true }), null)
assert.ok(result([[21, 19], [21, 19]], { ...rules, terceiroSetObrigatorio: true }))
assert.ok(result([[21, 19], [21, 19], [15, 14]], { ...rules, terceiroSetObrigatorio: true }))
assert.ok(result([[21, 19], [21, 19], [15, 13]]))
assert.equal(result([[25, 20], [25, 23], [20, 25], [23, 25], [17, 15]], { ...rules, setsPorPartida: 5, pontosPorSet: 25 }), null)
assert.ok(result([[21, 19], [19, 21]], { ...rules, setsPorPartida: 2, setsFormato: 'QUANTIDADE_FIXA', tieBreakUltimoSet: false }))
assert.ok(result([[21, -1], [21, 19]]))
assert.equal(result([[23, 19], [21, 19]]), null, 'acima do alvo, margem maior que 2 continua válida')
assert.ok(validateCategoryResult([{ numero: 2, pontosA: 21, pontosB: 19 }], rules))
const progress = (scores: number[][]) => validateCategoryProgress(scores.map(([pontosA, pontosB], i) => ({ numero: i + 1, pontosA, pontosB })), rules)
assert.equal(progress([[10, 8]]), null)
assert.equal(progress([[21, 19], [4, 2]]), null)
assert.ok(progress([[21, 20], [4, 2]]))
assert.ok(progress([[10, 8], [4, 2]]))
const terceiro = { ...rules, terceiroSetObrigatorio: true }
const andamentoTerceiro = (scores: number[][]) => validateCategoryProgress(scores.map(([pontosA, pontosB], i) => ({ numero: i + 1, pontosA, pontosB })), terceiro)
assert.equal(andamentoTerceiro([[21, 19], [21, 18], [5, 3]]), null, 'terceiro set obrigatório aceita o set 3 em andamento')
assert.ok(progress([[21, 19], [21, 18], [5, 3]]), 'sem terceiro obrigatório o set 3 depois de 2x0 é recusado')
console.log('Category match rules passed: configured targets, deuce, optional/mandatory third, BO5, ties, unfinished/extra sets and invalid points.')
