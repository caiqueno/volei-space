import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { iniciais } from '../src/lib/iniciais'

function antigoMvp(nome: string) {
  return nome.split(' ').slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

function antigoEscudo(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

function antigoSumula(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('') || 'AT'
}

const amostras = ['', ' ', '  ', 'Ana', 'Ana Silva', 'Ana  Silva', '  Ana', 'Ana Silva Costa', 'Érica Souza', 'joão', 'ßeta', 'ﬁlip', 'İbrahim', 'Maria-Clara Souza', '李 雷']

for (const nome of amostras) {
  assert.equal(iniciais(nome, { manterEspacosRepetidos: true }), antigoMvp(nome), `mvp ${JSON.stringify(nome)}`)
  assert.equal(iniciais(nome), antigoEscudo(nome), `escudo ${JSON.stringify(nome)}`)
  assert.equal(iniciais(nome) || 'AT', antigoSumula(nome), `sumula ${JSON.stringify(nome)}`)
}

for (let codigo = 0; codigo <= 0xffff; codigo += 1) {
  const nome = `${String.fromCharCode(codigo)} Silva`
  assert.equal(iniciais(nome) || 'AT', antigoSumula(nome))
  assert.equal(iniciais(nome, { manterEspacosRepetidos: true }), antigoMvp(nome))
}

const raiz = process.cwd()
const quadro = fs.readFileSync(path.join(raiz, 'src/components/portal/QuadroPublico.tsx'), 'utf8')
const chave = fs.readFileSync(path.join(raiz, 'src/components/mata-mata/ChaveamentoMataMata.tsx'), 'utf8')
const ranking = fs.readFileSync(path.join(raiz, 'src/components/portal/PainelRanking.tsx'), 'utf8')
const sumula = fs.readFileSync(path.join(raiz, 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')

assert.match(quadro, /<VistaChavePublica ligaId=\{ligaId\} chave=\{chave\} \/>/)
assert.equal(quadro.includes('Pódio do campeonato'), false)
assert.equal(quadro.includes('Chaveamento eliminatório'), false)
assert.equal(quadro.includes('ChaveamentoMataMata'), false)
assert.equal(chave.includes('Partida ao vivo'), false)
assert.match(chave, /AO VIVO/)
assert.match(chave, /\{sigla \|\| '–'\}/)
assert.match(ranking, /iniciais\(dados\.mvp, \{ manterEspacosRepetidos: true \}\)/)
assert.match(sumula, /iniciais\(player\.name\) \|\| 'AT'/)
assert.equal(sumula.includes('function initials'), false)

console.log('iniciais ok')
