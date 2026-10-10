import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { quantidadeDeLiberos } from '../src/lib/libero-sumula'

assert.equal(quantidadeDeLiberos(null), null)
assert.equal(quantidadeDeLiberos(undefined), null)
assert.equal(quantidadeDeLiberos(0), null)
assert.equal(quantidadeDeLiberos(3), null)
assert.equal(quantidadeDeLiberos(1), 1)
assert.equal(quantidadeDeLiberos(2), 2)

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010139990_libero_sumula.sql'), 'utf8')
assert.match(sql, /add column if not exists "exigirLiberoInicial" boolean/)
assert.match(sql, /add column if not exists "quantidadeLiberos" integer/)
assert.doesNotMatch(sql, /\bgrant\b/i)
assert.doesNotMatch(sql, /create\s+table/i)
assert.doesNotMatch(sql, /default\s+false/i)

const leitura = fs.readFileSync(path.join(process.cwd(), 'src/lib/regras-da-partida.ts'), 'utf8')
const comLibero = leitura.indexOf('${CAMPOS_LIBERO}')
const semLibero = leitura.indexOf('select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO},${CAMPOS_TEMPOS},${CAMPOS_LESAO}`)', comLibero)
assert.ok(comLibero > 0 && semLibero > comLibero, 'sem as colunas, a leitura seguinte mantém lesão, tempos, alerta, sets e limite')

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('if (!selectedLibero && matchRules.exigirLiberoInicial)'))
assert.ok(tela.includes('Defina o líbero inicial do'))
assert.ok(tela.includes('exigirLiberoInicial: source?.exigirLiberoInicial !== false'))
assert.ok(tela.includes('quantidadeLiberos: quantidadeDeLiberos(source?.quantidadeLiberos)'))
assert.ok(tela.includes("if (tipo === 'troca_libero' || tipo === 'libero_exchange') continue") === false)
assert.ok(tela.includes('isLiberoExchange || porLesaoAtiva ? null : aplicarSubstituicao'))

console.log('libero ok')
