import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { escolherMvpDoCampeonato, partidaFinalUnica, type TotaisAtleta } from '../src/lib/mvp-campeonato'

const totais: TotaisAtleta[] = [
  { id: 1, nome: 'Ana Souza', pontos: 40, saque: 10, ataque: 20, bloqueio: 10 },
  { id: 3356, nome: 'Matheus Paschoal de Farias', pontos: 12, saque: 2, ataque: 8, bloqueio: 2 },
]

const daFinal = {
  jogadorId: 3356,
  nome: 'Matheus Paschoal de Farias',
  equipe: 'TARGET',
  fotoRostoUrl: 'https://cdn.exemplo/matheus.jpg',
  fotoUrl: null,
}

const escolhido = escolherMvpDoCampeonato(totais, daFinal)
assert.equal(escolhido?.origem, 'final')
assert.equal(escolhido?.nome, 'Matheus Paschoal de Farias')
assert.equal(escolhido?.equipe, 'TARGET')
assert.equal(escolhido?.foto, 'https://cdn.exemplo/matheus.jpg')
assert.equal(escolhido?.pontos, 12)
assert.notEqual(escolhido?.nome, 'Ana Souza')

const semFoto = escolherMvpDoCampeonato(totais, { ...daFinal, fotoRostoUrl: '  ', fotoUrl: null })
assert.equal(semFoto?.foto, null)

const semScout = escolherMvpDoCampeonato(totais, { ...daFinal, jogadorId: 9, nome: 'Atleta Novo' })
assert.equal(semScout?.origem, 'final')
assert.equal(semScout?.pontos, 0)

const porPontos = escolherMvpDoCampeonato(totais, null)
assert.equal(porPontos?.origem, 'pontos')
assert.equal(porPontos?.nome, 'Ana Souza')
assert.equal(porPontos?.foto, null)
assert.equal(escolherMvpDoCampeonato([], null), null)

const categoria = '11111111-1111-4111-8111-111111111111'
assert.equal(partidaFinalUnica([
  { id: 1097, rodada: 1, categoriaCampeonatoId: categoria },
  { id: 2000, rodada: 1, categoriaCampeonatoId: '22222222-2222-4222-8222-222222222222' },
], categoria)?.id, 1097)
assert.equal(partidaFinalUnica([
  { id: 1097, rodada: 1, categoriaCampeonatoId: categoria },
  { id: 2000, rodada: 1, categoriaCampeonatoId: '22222222-2222-4222-8222-222222222222' },
], null), null)
assert.equal(partidaFinalUnica([{ id: 1097, rodada: 1, categoriaCampeonatoId: categoria }], null)?.id, 1097)

const rota = readFileSync('src/app/api/portal/rankings/route.ts', 'utf8')
assert.match(rota, /DestaquesPartida/)
assert.match(rota, /fase', 'FINAL'/)
assert.match(rota, /escolherMvpDoCampeonato/)
assert.equal(rota.includes('.insert('), false)
assert.equal(rota.includes('.update('), false)
assert.equal(rota.includes('.delete('), false)

const card = readFileSync('src/components/portal/PainelRanking.tsx', 'utf8')
assert.match(card, /rounded-full/)
assert.match(card, /#ffb331/)
assert.match(card, /cartazMvpCampeonato/)
assert.match(card, /BotaoStoriesInstagram/)

const podio = readFileSync('src/components/portal/VistaChavePublica.tsx', 'utf8')
assert.match(podio, /cartazPodio/)
assert.match(podio, /Campeão, vice e 3º lugar/)
assert.match(podio, /BotaoStoriesInstagram/)

console.log('mvp-campeonato: ok')
