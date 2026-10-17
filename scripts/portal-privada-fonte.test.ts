import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagina = readFileSync('src/app/campeonatos/page.tsx', 'utf8')
assert.ok(pagina.includes('semIdsPrivados(') && pagina.includes('idsCompeticoesPrivadas()'), 'lista de campeonatos descarta privadas')
const jogos = readFileSync('src/components/portal/JogosPublicos.tsx', 'utf8')
assert.ok(jogos.includes('privadas.has(Number(campeonato.id))'), 'jogos públicos recusam competição privada')
console.log('portal-privada-fonte ok')
