import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { papeletaDoProximoSet } from '../src/lib/escalacao-inicial'
import { ordenarPorCamisaDaSumula } from '../src/lib/ordem-camisa-sumula'

assert.deepEqual(papeletaDoProximoSet(), ['', '', '', '', '', ''])
assert.notEqual(papeletaDoProximoSet(), papeletaDoProximoSet())

const atletas = [
  { id: 'a', camisa: '10', nome: 'Zeca' },
  { id: 'b', camisa: '2', nome: 'Bruno' },
  { id: 'c', camisa: '', nome: 'Sem Camisa' },
  { id: 'd', camisa: '2', nome: 'Ana' },
  { id: 'e', camisa: '-1', nome: 'Outro' },
  { id: 'f', camisa: 'sem', nome: 'Mara' },
  { id: 'g', camisa: '0', nome: 'Zero' },
]
assert.deepEqual(
  ordenarPorCamisaDaSumula(atletas, (item) => item.camisa, (item) => item.nome).map((item) => item.id),
  ['g', 'd', 'b', 'a', 'f', 'e', 'c'],
)

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('setLineupA(papeletaDoProximoSet())'))
assert.ok(tela.includes('setLineupB(papeletaDoProximoSet())'))
assert.ok(tela.includes('ordenarPorCamisaDaSumula('))
assert.ok(tela.includes('setScoreHistory([])'))

console.log('ordem-camisa-sumula: ok')
