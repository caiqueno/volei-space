import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { avisoLinks, deveMostrarLinks, linkWhatsapp, normalizarVisibilidade, rotuloVisibilidade, urlCompleta } from '../src/components/parametrizacao/sections/inscricoes/visibilidade-ui'

assert.equal(normalizarVisibilidade(undefined), 'PUBLICA')
assert.equal(normalizarVisibilidade(null), 'PUBLICA')
assert.equal(normalizarVisibilidade('xyz'), 'PUBLICA')
assert.equal(normalizarVisibilidade(' privada '), 'PRIVADA')
assert.equal(rotuloVisibilidade('PRIVADA'), 'Privada (só entra quem tem o link)')
assert.equal(rotuloVisibilidade(undefined), 'Pública')
assert.equal(deveMostrarLinks('PRIVADA'), true)
assert.equal(deveMostrarLinks('PUBLICA'), false)
assert.equal(deveMostrarLinks(undefined), false)

assert.ok(avisoLinks([])?.includes('categoria'))
assert.ok(avisoLinks([{ id: 1, nome: 'A', caminho: null }])?.includes('Nenhum link'))
assert.ok(avisoLinks([{ id: 1, nome: 'A', caminho: '/x' }, { id: 2, nome: 'B', caminho: null }])?.startsWith('1 categoria'))
assert.equal(avisoLinks([{ id: 1, nome: 'A', caminho: '/x' }]), null)

assert.equal(urlCompleta('https://volei.space/', '/inscricao/categoria/t'), 'https://volei.space/inscricao/categoria/t')
const zap = linkWhatsapp('Sub 17', 'https://volei.space/inscricao/categoria/t')
assert.ok(zap.startsWith('https://wa.me/?text='))
assert.ok(decodeURIComponent(zap).includes('Sub 17'))

const pasta = 'src/components/parametrizacao/sections/inscricoes/'
const wizard = readFileSync(pasta + 'InscricoesWizard.tsx', 'utf8') + readFileSync(pasta + 'LinksCategoriaPrivada.tsx', 'utf8')
assert.ok(wizard.includes('visibilidade-ui') && wizard.includes('Copiar link') && wizard.includes('Enviar por WhatsApp'))
console.log('visibilidade-ui ok')
