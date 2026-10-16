import assert from 'node:assert/strict'
import { avaliarConvite, linkVigente } from '../src/lib/meu-time/convite'

const agora = new Date('2026-10-16T12:00:00Z').getTime()
const link = { token: 'link-liga', ativo: true, revogadoEm: null, expiraEm: null }

// Sem token de categoria, sem link e não privada: opcional, ignora o que vier.
assert.deepEqual(avaliarConvite(undefined, { tokenCategoria: null, linkCampeonato: null }, agora), { ok: true, exigido: false })
assert.deepEqual(avaliarConvite('qualquer', { tokenCategoria: null, linkCampeonato: null }, agora), { ok: true, exigido: false })

// Categoria com link.
const cat = { tokenCategoria: 'tk-cat', linkCampeonato: null }
const semConvite = avaliarConvite(undefined, cat, agora)
assert.equal(semConvite.ok, false)
assert.equal(!semConvite.ok && semConvite.codigo, 'CONVITE_OBRIGATORIO')
assert.equal(!semConvite.ok && semConvite.status, 403)
assert.equal(avaliarConvite('   ', cat, agora).ok, false, 'só espaços')
const errado = avaliarConvite('tk-outro', cat, agora)
assert.equal(!errado.ok && errado.codigo, 'CONVITE_INVALIDO')
assert.equal(avaliarConvite('tk-cat', cat, agora).ok, true)
assert.equal(avaliarConvite(' tk-cat ', cat, agora).ok, true, 'aparado')
assert.equal(avaliarConvite('tk-ca', cat, agora).ok, false, 'prefixo não vale')

// Link ativo do campeonato.
const comLink = { tokenCategoria: null, linkCampeonato: link }
assert.equal(avaliarConvite(undefined, comLink, agora).ok, false)
assert.equal(avaliarConvite('link-liga', comLink, agora).ok, true)
assert.equal(avaliarConvite('tk-cat', { tokenCategoria: 'tk-cat', linkCampeonato: link }, agora).ok, true, 'categoria ou campeonato')
assert.equal(avaliarConvite('link-liga', { tokenCategoria: 'tk-cat', linkCampeonato: link }, agora).ok, true)

// Link desativado, revogado ou expirado não exige.
for (const inativo of [
  { ...link, ativo: false },
  { ...link, revogadoEm: '2026-01-01T00:00:00Z' },
  { ...link, expiraEm: '2026-10-01T00:00:00Z' },
]) {
  assert.equal(linkVigente(inativo, agora), false)
  assert.deepEqual(avaliarConvite(undefined, { tokenCategoria: null, linkCampeonato: inativo }, agora), { ok: true, exigido: false })
  assert.equal(avaliarConvite('link-liga', { tokenCategoria: 'tk-cat', linkCampeonato: inativo }, agora).ok, false, 'token de link inativo não vale')
}
assert.equal(linkVigente({ ...link, expiraEm: '2026-12-01T00:00:00Z' }, agora), true)

// Competição privada exige convite mesmo sem token cadastrado (nada a conferir: fecha).
const privada = avaliarConvite('x', { tokenCategoria: null, linkCampeonato: null, privada: true }, agora)
assert.equal(privada.ok, false)
assert.equal(!privada.ok && privada.codigo, 'CONVITE_INVALIDO')
assert.equal(!avaliarConvite(undefined, { tokenCategoria: null, linkCampeonato: null, privada: true }, agora).ok, true)

console.log('meu-time-convite: ok')
