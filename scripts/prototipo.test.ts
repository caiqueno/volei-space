import assert from 'node:assert/strict'
import { PERFIS, navegacao, getPasso, prototipoAtivo } from '../src/lib/prototipo/roteiro'
import { placarInicial, reducerPlacar, setEncerrado, type EstadoPlacar, type AcaoPlacar } from '../src/lib/prototipo/placar'
import { atribuir, papeletaCompleta, papeletaVazia } from '../src/lib/prototipo/papeleta'
import { validarPlanilha, ehMenor } from '../src/lib/prototipo/planilha'
import { PLANILHA_EXEMPLO } from '../src/lib/prototipo/exemplo'

assert.equal(PERFIS.length, 7)
assert.equal(prototipoAtivo('1'), true)
assert.equal(prototipoAtivo(undefined), false)
assert.equal(prototipoAtivo('0'), false)
const nav = navegacao('lider', 'convidar')!
assert.equal(nav.anterior, '/prototipo/lider/cadastrar-time')
assert.equal(nav.proximo, '/prototipo/lider/importar')
assert.equal(navegacao('lider', 'cadastrar-time')!.anterior, null)
assert.equal(navegacao('lider', 'notificacoes')!.proximo, null)
assert.equal(navegacao('x', 'y'), null)
assert.ok(getPasso('apontador', 'desafio'))

const rodar = (e: EstadoPlacar, ...a: AcaoPlacar[]) => a.reduce(reducerPlacar, e)
const pts = (e: EstadoPlacar, lado: 'A' | 'B', n: number) =>
  rodar(e, ...Array.from({ length: n }, () => ({ tipo: 'ponto', lado }) as AcaoPlacar))

// rotação só com troca de saque
let e = rodar(placarInicial(), { tipo: 'ponto', lado: 'A' })
assert.equal(e.rotacao.A, 0)
e = rodar(e, { tipo: 'ponto', lado: 'B' })
assert.equal(e.saque, 'B')
assert.equal(e.rotacao.B, 1)
assert.deepEqual(rodar(e, { tipo: 'desfazer' }).pontos, { A: 1, B: 0 })
// set exige 2 de diferença
e = pts(pts(placarInicial(), 'A', 24), 'B', 24)
assert.equal(e.set, 1)
e = pts(e, 'A', 1)
assert.equal(e.set, 1)
e = pts(e, 'A', 1)
assert.equal(e.set, 2)
assert.deepEqual(e.sets, { A: 1, B: 0 })
assert.equal(setEncerrado({ A: 15, B: 14 }, 5), null)
assert.equal(setEncerrado({ A: 15, B: 13 }, 5), 'A')
// partida em 3 sets
e = placarInicial()
for (let i = 0; i < 3; i++) e = pts(e, 'B', 25)
assert.equal(e.vencedor, 'B')
assert.equal(reducerPlacar(e, { tipo: 'ponto', lado: 'A' }), e)
// limites e pedido do banco
e = rodar(placarInicial(), { tipo: 'tempo', lado: 'A' }, { tipo: 'tempo', lado: 'A' }, { tipo: 'tempo', lado: 'A' })
assert.equal(e.tempos.A, 2)
e = rodar(placarInicial(), { tipo: 'pedido', lado: 'B', pedido: 'troca' }, { tipo: 'aceitar-pedido' })
assert.equal(e.subs.B, 1)
assert.equal(e.pedidoBanco, null)

// papeleta
let p = atribuir(papeletaVazia(), 0, 'a1')
p = atribuir(p, 2, 'a1')
assert.deepEqual(p.slice(0, 3), [null, null, 'a1'])
assert.equal(papeletaCompleta(p), false)
for (let i = 0; i < 6; i++) p = atribuir(p, i, `a${i + 1}`)
assert.equal(papeletaCompleta(p), true)

// planilha
const l = validarPlanilha(PLANILHA_EXEMPLO)
assert.equal(l.length, 5)
assert.equal(l[0].erros.length, 1)
assert.ok(l[2].erros.includes('Nome obrigatório'))
assert.ok(l[3].erros.some((x) => x.includes('Data')))
assert.equal(ehMenor('2010-06-01', '2026-01-01'), true)
assert.equal(ehMenor('2008-01-01', '2026-01-01'), false)
assert.equal(ehMenor('2008-01-02', '2026-01-01'), true)
console.log('prototipo: ok')
