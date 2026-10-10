import assert from 'node:assert/strict'
import { dataHoraUtc, normalizarDatasHora, ordenarJogos } from '../src/lib/data-hora'
import { formatarDataPartida } from '../src/lib/format-partida'
import { manterPaginaAberta } from '../src/lib/pagina-aberta'

assert.equal(dataHoraUtc('2026-10-10T11:30:00'), '2026-10-10T11:30:00.000Z')
assert.equal(dataHoraUtc('2026-10-10 11:30:00'), '2026-10-10T11:30:00.000Z')
assert.equal(dataHoraUtc('2026-10-10T11:30:00.000Z'), '2026-10-10T11:30:00.000Z')
assert.equal(dataHoraUtc('2026-10-10T11:30:00+00:00'), '2026-10-10T11:30:00.000Z')
assert.equal(dataHoraUtc(null), null)
assert.equal(dataHoraUtc(''), null)

const texto = formatarDataPartida('2026-10-10T11:30:00')
assert.match(texto ?? '', /08:30/)

const entrada = { partidas: [{ id: 1, dataHora: '2026-10-10T11:30:00' }] }
const saida = normalizarDatasHora(entrada)
assert.equal(saida.partidas[0].dataHora, '2026-10-10T11:30:00.000Z')
assert.equal(entrada.partidas[0].dataHora, '2026-10-10T11:30:00')
assert.equal(normalizarDatasHora({ dataHora: null }).dataHora, null)

const jogos = ordenarJogos([
  { id: 3, dataHora: '2026-10-11T11:30:00', rodada: 1 },
  { id: 2, dataHora: '2026-10-10T15:00:00', rodada: 2 },
  { id: 1, dataHora: '2026-10-10T15:00:00', rodada: 1 },
  { id: 4, dataHora: null, rodada: 1 },
])
assert.deepEqual(jogos.map((jogo) => jogo.id), [1, 2, 3, 4])

const aberta = [{ id: 2, dataHora: '2026-10-10T18:00:00', rodada: 1 }]
const releitura = [
  { id: 1, dataHora: '2026-10-10T11:30:00', rodada: 2 },
  { id: 2, dataHora: '2026-10-10T18:00:00', rodada: 1 },
]
assert.deepEqual(ordenarJogos(manterPaginaAberta(aberta, releitura, true)).map((jogo) => jogo.id), [1, 2])

const ids = new Set(aberta.map((jogo) => jogo.id))
const mais = [{ id: 1, dataHora: '2026-10-10T11:30:00', rodada: 2 }]
assert.deepEqual(ordenarJogos([...aberta, ...mais.filter((jogo) => !ids.has(jogo.id))]).map((jogo) => jogo.id), [1, 2])

console.log('ordem-jogos ok')
