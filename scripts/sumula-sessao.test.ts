import assert from 'node:assert/strict'
import {
  TEXTO_AGUARDANDO_OFICIALIZACAO,
  confirmarPapeletas,
  descricaoAguardandoOficializacao,
  ocorrenciaOperacional,
  partidaEncerradaNaSessao,
} from '../src/lib/sumula-sessao'

const ocorrencias = [
  { tipo: 'system', set: 1, descricao: '10:00 | 00 x 00 | Escalação do Alpha conferida para o set 1. Líbero inicial: #21.' },
  { tipo: 'set_start', set: 1, descricao: '10:01 | 00 x 00 | Papeleta do set 1 confirmada.' },
]

assert.deepEqual(confirmarPapeletas(ocorrencias, 'Alpha', 'Beta', 1), { teamA: true, teamB: false })
assert.deepEqual(confirmarPapeletas(ocorrencias, 'Alpha', 'Beta', 2), { teamA: false, teamB: false })
assert.equal(partidaEncerradaNaSessao('EM_ANDAMENTO', ocorrencias), false)
assert.equal(partidaEncerradaNaSessao('ENCERRADA', []), true)

const encerrada = [...ocorrencias, { tipo: 'system', set: 2, descricao: `12:00 | 21 x 18 | ${TEXTO_AGUARDANDO_OFICIALIZACAO}` }]
assert.equal(descricaoAguardandoOficializacao(TEXTO_AGUARDANDO_OFICIALIZACAO), true)
assert.equal(partidaEncerradaNaSessao('EM_ANDAMENTO', encerrada), true)
assert.deepEqual(
  confirmarPapeletas(
    [...encerrada, { tipo: 'system', set: 2, descricao: '12:00 | 21 x 18 | Escalação do Beta conferida para o set 2.' }],
    'Alpha',
    'Beta',
    2,
  ),
  { teamA: false, teamB: true },
)

assert.equal(ocorrenciaOperacional({ tipo: 'system', descricao: 'escalação' }), true)
assert.equal(ocorrenciaOperacional({ tipo: 'point', descricao: 'Registro de placar pelo árbitro' }), true)
assert.equal(ocorrenciaOperacional({ tipo: 'point', descricao: '10:00 | 01 x 00 | ACE' }), false)

console.log('sumula-sessao: ok')
