import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  AVISO_CAMISA,
  apenasDigitosCamisa,
  buscarJogadorPorCamisa,
  decidirCamisa,
  proximaPosicaoVazia,
  type JogadorDaPapeleta,
} from '../src/lib/busca-camisa-papeleta'

const elenco: JogadorDaPapeleta[] = [
  { numero: '13', camisa: '1', libero: false },
  { numero: '9', camisa: '10', libero: false },
  { numero: '4', camisa: '07', libero: false },
  { numero: '2', camisa: '2', libero: true },
  { numero: '8', camisa: '8', libero: false },
]

const porUm = buscarJogadorPorCamisa('1', elenco, [])
const porZeroUm = buscarJogadorPorCamisa('01', elenco, [])
assert.deepEqual(porUm, { ok: true, numero: '13' })
assert.deepEqual(porZeroUm, porUm)
assert.equal(porUm.ok && porUm.numero, '13')

const camisaComZero = [
  { numero: '13', camisa: '01', libero: false },
  { numero: '9', camisa: '10', libero: false },
]
assert.deepEqual(buscarJogadorPorCamisa('1', camisaComZero, []), { ok: true, numero: '13' })
assert.deepEqual(buscarJogadorPorCamisa('01', camisaComZero, []), { ok: true, numero: '13' })

assert.deepEqual(buscarJogadorPorCamisa('99', elenco, []), { ok: false, aviso: 'inexistente' })
assert.deepEqual(buscarJogadorPorCamisa('00', elenco, []), { ok: false, aviso: 'inexistente' })
assert.equal(AVISO_CAMISA.inexistente, 'Número não encontrado.')

assert.deepEqual(buscarJogadorPorCamisa('1', elenco, ['13']), { ok: false, aviso: 'repetido' })
assert.deepEqual(buscarJogadorPorCamisa('01', elenco, ['13']), { ok: false, aviso: 'repetido' })
assert.equal(AVISO_CAMISA.repetido, 'Este atleta já está em outra posição.')

assert.deepEqual(buscarJogadorPorCamisa('2', elenco, []), { ok: false, aviso: 'libero' })
assert.deepEqual(buscarJogadorPorCamisa('8', elenco, [], '8'), { ok: false, aviso: 'libero' })
assert.equal(AVISO_CAMISA.libero, 'Líbero não entra nesta posição.')

assert.deepEqual(decidirCamisa({ digitado: '1', elenco: [{ numero: '5', camisa: '1', libero: false }], ocupados: [] }), {
  acao: 'escalar',
  numero: '5',
})
assert.deepEqual(decidirCamisa({ digitado: '01', elenco, ocupados: [] }), { acao: 'escalar', numero: '13' })
assert.deepEqual(decidirCamisa({ digitado: '1', elenco, ocupados: [] }), { acao: 'esperar' })
assert.deepEqual(decidirCamisa({ digitado: '1', elenco, ocupados: [], forcar: true }), { acao: 'escalar', numero: '13' })
assert.deepEqual(decidirCamisa({ digitado: '10', elenco, ocupados: [] }), { acao: 'escalar', numero: '9' })
assert.deepEqual(decidirCamisa({ digitado: '07', elenco, ocupados: [] }), { acao: 'escalar', numero: '4' })
assert.deepEqual(decidirCamisa({ digitado: '7', elenco, ocupados: [] }), { acao: 'escalar', numero: '4' })
assert.deepEqual(decidirCamisa({ digitado: '99', elenco, ocupados: [] }), { acao: 'avisar', aviso: 'inexistente' })
assert.deepEqual(decidirCamisa({ digitado: '1a', elenco, ocupados: [] }), { acao: 'esperar' })

assert.equal(apenasDigitosCamisa('1a0b'), '10')
assert.equal(apenasDigitosCamisa('00123'), '00')
assert.equal(apenasDigitosCamisa(''), '')

assert.equal(proximaPosicaoVazia(['13', '', '', '', '', ''], 0), 1)
assert.equal(proximaPosicaoVazia(['', '', '', '', '', ''], 5), 0)
assert.equal(proximaPosicaoVazia(['1', '2', '3', '4', '5', '6'], 2), null)

const tela = fs.readFileSync(path.join(process.cwd(), 'src/app/sumula/[token]/lancar/page.tsx'), 'utf8')
assert.ok(tela.includes('inputMode="numeric"'))
assert.ok(tela.includes('pattern="[0-9]*"'))
assert.ok(tela.includes('apenasDigitosCamisa('))
assert.ok(tela.includes('decidirCamisa('))
assert.ok(tela.includes('props.changeSlot(selectedTeamId, index, decisao.numero)'))
assert.ok(tela.includes('props.getMatchNumber(selectedTeamId, player.number)'))

const rota = fs.readFileSync(path.join(process.cwd(), 'src/app/api/sumula/[token]/route.ts'), 'utf8')
assert.equal(rota.includes('busca-camisa-papeleta'), false)
assert.equal(rota.includes('decidirCamisa'), false)

console.log('busca-camisa-papeleta: ok')
