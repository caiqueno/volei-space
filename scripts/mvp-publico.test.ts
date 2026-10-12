import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ehMvp, equipeDoAtleta, fotoDoAtleta } from '../src/lib/mvp-publico'

const lados = [
  {
    id: 10,
    nome: 'WINNERS PRIDE',
    jogadores: [{ id: 1, nome: 'Marina Costa', fotoRostoUrl: null, fotoUrl: null }],
  },
  {
    id: 20,
    nome: 'BLACK TREFOIL',
    jogadores: [{ id: 2, nome: 'Olivia Nunes', fotoRostoUrl: 'https://cdn.exemplo/olivia-rosto.jpg', fotoUrl: 'https://cdn.exemplo/olivia.jpg' }],
  },
]

assert.equal(ehMvp('MVP'), true)
assert.equal(ehMvp(' mvp '), true)
assert.equal(ehMvp('Ataque'), false)

assert.equal(fotoDoAtleta({ id: 2, fotoRostoUrl: 'https://cdn.exemplo/destaque.jpg', fotoUrl: 'https://cdn.exemplo/outra.jpg' }, lados), 'https://cdn.exemplo/destaque.jpg')
assert.equal(fotoDoAtleta({ id: 2, fotoRostoUrl: '  ', fotoUrl: null }, lados), 'https://cdn.exemplo/olivia-rosto.jpg')
assert.equal(fotoDoAtleta({ id: 1, nome: 'Marina Costa' }, lados), null)
assert.equal(fotoDoAtleta({ id: 9 }, lados), null)

assert.equal(equipeDoAtleta(1, lados), 'WINNERS PRIDE')
assert.equal(equipeDoAtleta(2, [{ id: 20, nome: 'BLACK TREFOIL', jogadores: [] }], [{ jogadorId: 2, equipeId: 20 }]), 'BLACK TREFOIL')
assert.equal(equipeDoAtleta(9, lados), null)
assert.equal(equipeDoAtleta(null, lados), null)

const tela = readFileSync('src/app/partidas/[id]/ao-vivo/LiveMatchView.tsx', 'utf8')
assert.match(tela, /live-match-mvp-avatar/)
assert.match(tela, /live-match-mvp-equipe/)
assert.match(tela, /fotoDoAtleta/)
assert.match(tela, /equipeDoAtleta/)
assert.match(tela, /ehMvp/)
assert.equal(tela.includes('playerPhoto'), false)

const css = readFileSync('src/app/globals.css', 'utf8')
assert.match(css, /\.live-match-highlights \.live-match-mvp-avatar[\s\S]*border:\s*3px solid #ffb331/)
assert.match(css, /\.live-match-highlights \.live-match-mvp-avatar[\s\S]*border-radius:\s*50%/)
assert.match(css, /\.live-match-highlights \.live-match-mvp-avatar img[\s\S]*object-fit:\s*cover/)
assert.match(css, /\.live-match-highlights \.live-match-mvp \.live-match-mvp-equipe/)

console.log('mvp-publico: ok')
