import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CHAVE_SIDEBAR_SUMULA, gravarSidebarSumula, lerSidebarSumula } from '../src/lib/sidebar-sumula'

const memoria = new Map<string, string>()
const storage = {
  getItem: (chave: string) => memoria.get(chave) ?? null,
  setItem: (chave: string, valor: string) => { memoria.set(chave, valor) },
}

assert.equal(lerSidebarSumula(null), 'fixa')
assert.equal(lerSidebarSumula(storage), 'fixa')
gravarSidebarSumula(storage, 'recolhida')
assert.equal(storage.getItem(CHAVE_SIDEBAR_SUMULA), 'recolhida')
assert.equal(lerSidebarSumula(storage), 'recolhida')
gravarSidebarSumula(storage, 'fixa')
assert.equal(lerSidebarSumula(storage), 'fixa')
memoria.set(CHAVE_SIDEBAR_SUMULA, 'outra')
assert.equal(lerSidebarSumula(storage), 'fixa')

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('aria-expanded={sidebarFixa}'))
assert.ok(tela.includes('Recolher menu da súmula'))
assert.ok(tela.includes('Fixar menu da súmula'))
assert.ok(tela.includes('aria-controls="sumula-sidebar"'))
assert.ok(tela.includes('id="sumula-sidebar"'))
assert.ok(tela.includes("gravarSidebarSumula(window.localStorage, proxima)"))
assert.ok(tela.includes('is-collapsed'))

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')
assert.ok(css.includes('.official-sidebar.is-collapsed'))
assert.ok(css.includes('min-width: 1101px'))

console.log('sidebar-sumula: ok')
