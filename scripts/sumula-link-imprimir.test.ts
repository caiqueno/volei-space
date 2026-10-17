import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { linkImprimirSumula } from '../src/lib/sumula-ui/link-imprimir'

assert.equal(linkImprimirSumula({ id: 5, sumulaToken: 'abc' }), '/sumula/abc/imprimir')
assert.equal(linkImprimirSumula({ id: 5, sumulaToken: 'a b/c' }), '/sumula/a%20b%2Fc/imprimir')
assert.equal(linkImprimirSumula({ id: 5, sumulaToken: 'abc', campeonatoPublicado: false }), '/sumula/abc/imprimir')
assert.equal(linkImprimirSumula({ id: 5, sumulaToken: null }), null)
assert.equal(linkImprimirSumula({ id: 5, sumulaToken: '  ' }), null)
assert.equal(linkImprimirSumula({ id: 5, campeonatoPublicado: false }), null)
assert.equal(linkImprimirSumula({ id: 5, campeonatoPublicado: true }), '/sumula/5/imprimir')
assert.equal(linkImprimirSumula({ id: 'x1', campeonatoPublicado: true }), null)
assert.equal(linkImprimirSumula({ id: null, campeonatoPublicado: true }), null)

for (const arquivo of ['src/app/arbitro/partida/[token]/page.tsx', 'src/components/painel/organizador/PainelConteudos.tsx']) {
  const texto = readFileSync(arquivo, 'utf8')
  assert.ok(texto.includes('linkImprimirSumula('), `${arquivo} usa a regra compartilhada`)
  assert.ok(texto.includes('Imprimir súmula'), `${arquivo} mostra o rótulo`)
  assert.ok(texto.includes('campeonatoPublicado: partida.campeonatoPublicado === true'), `${arquivo} repassa campeonatoPublicado do payload`)
}

console.log('sumula-link-imprimir ok')
