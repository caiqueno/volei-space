import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { validarSubstituicoes } from '../src/lib/sumula-regras'
import { textoSubstituicaoLesao, textoTempoMedico } from '../src/lib/lesao-sumula'

const equipes = [{ id: 1, nome: 'Alpha' }]
const substituicao = (saiu: number, entrou: number) => ({
  tipo: 'substitution',
  set: 1,
  descricao: `Substituição Alpha: sai #${saiu}, entra #${entrou}.`,
})
const oito = Array.from({ length: 8 }, (_, indice) => substituicao(indice + 1, indice + 11))
const lesao = { tipo: 'lesao', set: 1, descricao: textoSubstituicaoLesao('Alpha', '9', 'Nove', '19', 'Dezenove') }

assert.equal(validarSubstituicoes({ equipes, ocorrencias: oito }), null)
assert.match(validarSubstituicoes({ equipes, ocorrencias: [...oito, lesao] }) ?? '', /8 substituições/)
assert.equal(validarSubstituicoes({ equipes, ocorrencias: [...oito, lesao], substituicaoPorLesao: true }), null)
assert.equal(textoTempoMedico('Alpha'), 'Tempo médico solicitado por Alpha.')

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010139980_lesao_sumula.sql'), 'utf8')
assert.match(sql, /add column if not exists "tempoMedico" boolean/)
assert.match(sql, /add column if not exists "substituicaoPorLesao" boolean/)
assert.doesNotMatch(sql, /\bgrant\b/i)
assert.doesNotMatch(sql, /create\s+table/i)
assert.doesNotMatch(sql, /default\s+true/i)

const leitura = fs.readFileSync(path.join(process.cwd(), 'src/lib/regras-da-partida.ts'), 'utf8')
const comLesao = leitura.indexOf('${CAMPOS_LESAO}')
const semLesao = leitura.indexOf('select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO},${CAMPOS_TEMPOS}`)', comLesao)
assert.ok(comLesao > 0 && semLesao > comLesao, 'sem as colunas, a leitura seguinte mantém tempos, alerta, sets e limite')

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('if (!matchRules.tempoMedico || !teamA || !teamB) return'))
assert.ok(tela.includes('{tempoMedico ? ('))
// A substituição excepcional agora passa pelo motor de regras; a flag da categoria só decide
// se o servidor ainda soma essa troca ao limite (aviso no modal).
assert.ok(tela.includes("modo === 'excepcional'"))
assert.ok(tela.includes('excepcionalContaNoServidor: !matchRules.substituicaoPorLesao'))
assert.ok(tela.includes('{permiteLesao ? ('))
assert.ok(tela.includes('tempoMedico: source?.tempoMedico === true'))
assert.ok(tela.includes('substituicaoPorLesao: source?.substituicaoPorLesao === true'))

console.log('lesao ok')
