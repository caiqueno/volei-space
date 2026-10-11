import assert from 'node:assert/strict'
import {
  MENSAGEM_NUMERO_REPETIDO,
  payloadNovoAtleta,
  presencaHerdadaDoAtleta,
  presencaNaTela,
  ultimaPartidaDaEquipe,
  validarNovoAtleta,
  type PartidaDaEquipe,
} from '../src/lib/presenca-herdada'

const equipe = 10
const outra = 20
const liga = 3
const atual = 40

function jogo(parcial: Partial<PartidaDaEquipe> & Pick<PartidaDaEquipe, 'id'>): PartidaDaEquipe {
  return {
    equipeAId: equipe,
    equipeBId: 99,
    ligaId: liga,
    dataHora: '2026-10-01T15:00:00.000Z',
    status: 'ENCERRADA',
    ...parcial,
  }
}

const partidas = [
  jogo({ id: 10, dataHora: '2026-09-01T15:00:00.000Z' }),
  jogo({ id: 30, dataHora: '2026-10-02T15:00:00.000Z', status: 'AGENDADA' }),
  jogo({ id: 12, dataHora: '2026-10-01T15:00:00.000Z', status: 'CANCELADA' }),
  jogo({ id: 11, dataHora: null, status: 'ENCERRADA' }),
  jogo({ id: 21, equipeAId: outra, equipeBId: equipe, dataHora: '2026-10-03T18:00:00.000Z', status: 'WO' }),
  jogo({ id: atual, dataHora: '2026-10-11T18:00:00.000Z' }),
  jogo({ id: 50, ligaId: 8, dataHora: '2026-10-10T18:00:00.000Z' }),
]

const ultima = ultimaPartidaDaEquipe({ equipeId: equipe, ligaId: liga, partidaAtualId: atual, partidas })
assert.equal(ultima?.id, 21)
assert.equal(ultimaPartidaDaEquipe({ equipeId: 77, ligaId: liga, partidaAtualId: atual, partidas }), null)

const mesmaHora = [
  jogo({ id: 4, dataHora: '2026-10-01T15:00:00.000Z' }),
  jogo({ id: 8, dataHora: '2026-10-01T15:00:00.000Z' }),
]
assert.equal(ultimaPartidaDaEquipe({ equipeId: equipe, ligaId: liga, partidaAtualId: atual, partidas: mesmaHora })?.id, 8)

const presencas = [
  { partidaId: 10, jogadorId: 1, equipeId: equipe, presente: true },
  { partidaId: 21, jogadorId: 1, equipeId: equipe, presente: false },
  { partidaId: 21, jogadorId: 2, equipeId: equipe, presente: true },
  { partidaId: 21, jogadorId: 3, equipeId: equipe, presente: null },
  { partidaId: 21, jogadorId: 4, equipeId: outra, presente: true },
]
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 1, equipeId: equipe, ultimaPartidaId: 21, presencas }), false)
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 2, equipeId: equipe, ultimaPartidaId: 21, presencas }), true)
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 3, equipeId: equipe, ultimaPartidaId: 21, presencas }), null)
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 9, equipeId: equipe, ultimaPartidaId: 21, presencas }), null)
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 4, equipeId: equipe, ultimaPartidaId: 21, presencas }), null)
assert.equal(presencaHerdadaDoAtleta({ jogadorId: 1, equipeId: equipe, ultimaPartidaId: null, presencas }), null)

assert.equal(presencaNaTela({ presenteDesteJogo: false, presencaHerdada: true }), false)
assert.equal(presencaNaTela({ presenteDesteJogo: true, presencaHerdada: false }), true)
assert.equal(presencaNaTela({ presenteDesteJogo: null, presencaHerdada: true }), true)
assert.equal(presencaNaTela({ presenteDesteJogo: null, presencaHerdada: false }), false)
assert.equal(presencaNaTela({ presenteDesteJogo: null, presencaHerdada: null }), null)

const elenco = [
  { id: 1, equipeId: equipe, numero: 7 },
  { id: 2, equipeId: equipe, numero: 0, banido: true },
  { id: 3, equipeId: outra, numero: 4 },
]
assert.deepEqual(validarNovoAtleta({ nome: '  Ana Souza ', numero: '01', atletas: elenco, equipeId: equipe }), { nome: 'Ana Souza', numero: 1 })
const repetido = validarNovoAtleta({ nome: 'Bia', numero: '7', atletas: elenco, equipeId: equipe })
assert.equal('erro' in repetido ? repetido.erro : '', MENSAGEM_NUMERO_REPETIDO)
assert.deepEqual(validarNovoAtleta({ nome: 'Bia', numero: '0', atletas: elenco, equipeId: equipe }), { nome: 'Bia', numero: 0 })
assert.deepEqual(validarNovoAtleta({ nome: 'Bia', numero: '4', atletas: elenco, equipeId: equipe }), { nome: 'Bia', numero: 4 })
const semNome = validarNovoAtleta({ nome: '   ', numero: '4', atletas: elenco })
const foraDaFaixa = validarNovoAtleta({ nome: 'Bia', numero: '100', atletas: elenco })
const semNumero = validarNovoAtleta({ nome: 'Bia', numero: '', atletas: elenco })
assert.equal('erro' in semNome, true)
assert.equal('erro' in foraDaFaixa, true)
assert.equal('erro' in semNumero, true)

const payload = payloadNovoAtleta({ nome: 'Ana Souza', equipeId: equipe, numero: 1 })
assert.deepEqual(payload, { nome: 'Ana Souza', equipeId: equipe, numero: 1 })
assert.deepEqual(Object.keys(payload), ['nome', 'equipeId', 'numero'])
