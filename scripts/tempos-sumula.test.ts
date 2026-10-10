import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ehTempoDeEquipe, limiteDeTempos, textoTempoEquipe, textoTempoTecnico } from '../src/lib/tempos-sumula'

assert.equal(limiteDeTempos(null), 2)
assert.equal(limiteDeTempos(undefined), 2)
assert.equal(limiteDeTempos(0), 2)
assert.equal(limiteDeTempos(5), 2)
assert.equal(limiteDeTempos('2'), 2)
assert.equal(limiteDeTempos(1), 1)
assert.equal(limiteDeTempos(3), 3)
assert.equal(textoTempoTecnico('Alpha', 1, 2), 'Tempo técnico solicitado por Alpha (1/2 no set 2).')
assert.equal(textoTempoTecnico('Alpha', 2, 1, 2), 'Tempo técnico solicitado por Alpha (2/2 no set 1).')
assert.equal(textoTempoTecnico('Alpha', 1, 2, 3), 'Tempo técnico solicitado por Alpha (1/3 no set 2).')
assert.equal(textoTempoEquipe('Beta', 1, 1), 'Tempo de equipe solicitado por Beta (1/2 no set 1).')
assert.equal(ehTempoDeEquipe('Tempo de equipe solicitado por Beta'), true)
assert.equal(ehTempoDeEquipe('Tempo técnico solicitado por Beta'), false)

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010139970_tempos_sumula.sql'), 'utf8')
assert.match(sql, /add column if not exists "limiteTemposPorSet" integer/)
assert.match(sql, /add column if not exists "separarTempos" boolean/)
assert.doesNotMatch(sql, /\bgrant\b/i)
assert.doesNotMatch(sql, /create\s+table/i)
assert.doesNotMatch(sql, /default\s+true/i)

const leitura = fs.readFileSync(path.join(process.cwd(), 'src/lib/regras-da-partida.ts'), 'utf8')
const comTempos = leitura.indexOf('${CAMPOS_TEMPOS}')
const semTempos = leitura.indexOf('select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO}`)', comTempos)
assert.ok(comTempos > 0 && semTempos > comTempos, 'sem as colunas, a leitura seguinte mantém alerta, sets e limite')

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('textoTempoTecnico('))
assert.ok(tela.includes('const limite = matchRules.timeoutLimit'))
assert.ok(tela.includes('if (used >= limite)'))
assert.ok(tela.includes('timeoutLimit: limiteDeTempos(source?.limiteTemposPorSet)'))
assert.ok(tela.includes('temposSeparados: source?.separarTempos === true'))
assert.ok(tela.includes('{temposSeparados ? ('))
assert.equal(tela.includes('Tempo de equipe solicitado'), false)

console.log('tempos ok')
