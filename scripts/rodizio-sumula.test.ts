import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mensagemRodizioIlegal } from '../src/lib/rodizio-sumula'

const inicial = ['1', '2', '3', '4', '5', '6']
assert.equal(mensagemRodizioIlegal(inicial, inicial), null)
assert.equal(mensagemRodizioIlegal(inicial, ['1', '2', '12', '4', '5', '6']), null, 'substituição no lugar do 3')
assert.equal(mensagemRodizioIlegal(inicial, ['1', '12', '13', '4', '5', '6']), null, 'duas substituições')
assert.match(mensagemRodizioIlegal(inicial, ['2', '1', '3', '4', '5', '6']) ?? '', /Rodízio diferente/)
assert.equal(mensagemRodizioIlegal(['1'], inicial), null, 'escalação incompleta não alerta')
assert.equal(mensagemRodizioIlegal([], []), null)

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010139960_alerta_rodizio.sql'), 'utf8')
assert.match(sql, /add column if not exists "alertaRodizioIlegal" boolean/)
assert.doesNotMatch(sql, /\bgrant\b/i)
assert.doesNotMatch(sql, /create\s+table/i)
assert.doesNotMatch(sql, /default\s+true/i)

const leitura = fs.readFileSync(path.join(process.cwd(), 'src/lib/regras-da-partida.ts'), 'utf8')
const comAlerta = leitura.indexOf('${CAMPO_RODIZIO}')
const semAlerta = leitura.indexOf('select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE}`)', comAlerta)
assert.ok(comAlerta > 0 && semAlerta > comAlerta, 'sem a coluna, a leitura seguinte mantém sets e limite')

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('if (isSideOut && matchRules.alertaRodizio && scoreHistory.length > 0)'))
assert.ok(tela.includes('alertaRodizio: source?.alertaRodizioIlegal === true'))
assert.doesNotMatch(tela, /alertaRodizio[\s\S]{0,400}return addToast\('Rodízio/)

console.log('rodizio ok')
