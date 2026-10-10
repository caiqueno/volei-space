import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { entraNoSeletorDeLibero, lerLiberosIniciais, numeroDeLibero, quantidadeDeLiberos, rotuloSeletorLibero, textoLiberoInicial, validarLiberoDaSumula } from '../src/lib/libero-sumula'

assert.equal(quantidadeDeLiberos(null), null)
assert.equal(quantidadeDeLiberos(undefined), null)
assert.equal(quantidadeDeLiberos(0), null)
assert.equal(quantidadeDeLiberos(3), null)
assert.equal(quantidadeDeLiberos(1), 1)
assert.equal(quantidadeDeLiberos(2), 2)

const escalacaoAllBlack = ['9', '3', '2', '5', '1', '11']
assert.equal(entraNoSeletorDeLibero('13', escalacaoAllBlack), true)
assert.equal(entraNoSeletorDeLibero('1', escalacaoAllBlack), false)
assert.equal(rotuloSeletorLibero('Daniel Almeida Cozendey', '1'), '#1 - Daniel Almeida Cozendey')
assert.equal(rotuloSeletorLibero('Ivan Gonçalves Assumpçao', '0'), '#0 - Ivan Gonçalves Assumpçao')
assert.equal(rotuloSeletorLibero('Daniel Almeida Cozendey', '1').includes('#13'), false)

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

assert.equal(numeroDeLibero(''), '')
assert.equal(numeroDeLibero('--'), '')
assert.equal(numeroDeLibero('#--'), '')
assert.equal(numeroDeLibero('nenhum'), '')
assert.equal(numeroDeLibero('#8'), '8')
assert.equal(textoLiberoInicial(''), 'nenhum')
assert.equal(textoLiberoInicial('8'), '#8')
assert.equal(validarLiberoDaSumula(), null)

const fraseVazia = 'Papeleta do set 1 confirmada para os dois times. Líberos iniciais: SET POINT nenhum e LÍBERO FC nenhum. Saque inicial: SET POINT começa sacando.'
const lidaVazia = lerLiberosIniciais(fraseVazia)
assert.equal(lidaVazia?.equipeA, 'SET POINT')
assert.equal(lidaVazia?.liberoA, '')
assert.equal(lidaVazia?.equipeB, 'LÍBERO FC')
assert.equal(lidaVazia?.liberoB, '')

const fraseMista = '10:00 | 00 x 00 | Líberos iniciais: SET POINT #8 e LÍBERO FC nenhum. Saque inicial: SET POINT começa sacando.'
const lidaMista = lerLiberosIniciais(fraseMista)
assert.equal(lidaMista?.liberoA, '8')
assert.equal(lidaMista?.liberoB, '')

const fraseAntiga = 'Líberos iniciais: Alpha #12 e Beta #--. Saque inicial: Alpha começa sacando.'
const lidaAntiga = lerLiberosIniciais(fraseAntiga)
assert.equal(lidaAntiga?.liberoA, '12')
assert.equal(lidaAntiga?.liberoB, '')
assert.equal(lerLiberosIniciais(fraseAntiga)?.liberoA.includes('.'), false)

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.equal(tela.includes('if (!selectedLibero && matchRules.exigirLiberoInicial)'), false)
assert.equal(tela.includes('Defina o líbero inicial do'), false)
assert.equal(tela.includes('!reviewLibero'), false)
assert.equal(tela.includes('Defina antes de confirmar'), false)
assert.ok(tela.includes('<option value="">Nenhum</option>'))
assert.ok(tela.includes('disabled={!papeletaCompleta(lineup) || !servidorExibido || selectedTeamConfirmed}'))
assert.ok(tela.includes('textoLiberoInicial(startingLiberos[currentSet]?.teamA)'))
assert.ok(tela.includes('exigirLiberoInicial: source?.exigirLiberoInicial !== false'))

const rota = fs.readFileSync(path.join(process.cwd(), 'src/app/api/sumula/[token]/route.ts'), 'utf8')
assert.ok(rota.includes('validarLiberoDaSumula()'))
assert.equal(rota.includes('Defina o líbero'), false)
assert.equal(rota.includes('exige líbero'), false)
assert.ok(tela.includes('quantidadeLiberos: quantidadeDeLiberos(source?.quantidadeLiberos)'))
assert.ok(tela.includes("if (tipo === 'troca_libero' || tipo === 'libero_exchange') continue") === false)
assert.ok(tela.includes('isLiberoExchange || porLesaoAtiva ? null : aplicarSubstituicao'))
assert.ok(tela.includes('rotuloSeletorLibero(displayPlayerName(player.name, team.name), props.getMatchNumber(selectedTeamId, player.number))'))

console.log('libero ok')
