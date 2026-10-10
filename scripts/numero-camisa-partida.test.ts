import assert from 'node:assert/strict'
import {
  MARCA_SEM_NUMERO,
  NUMERO_SEM_CAMISA,
  interpretarNumeroCamisa,
  numeroMvpDaLista,
  numeroNaPartida,
  passagemDeNumeroCamisa,
  presencaFoiDecidida,
  proximoAtletaNoElenco,
  validarTrocaNumeroCamisa,
} from '../src/lib/numero-camisa-partida'

const elenco = [
  { id: 1, equipeId: 10, numero: 7 },
  { id: 2, equipeId: 10, numero: 10 },
  { id: 3, equipeId: 10, numero: null },
  { id: 4, equipeId: 99, numero: 7 },
]

const daEquipe = elenco.filter((atleta) => atleta.equipeId === 10).map((atleta, index) => ({
  ...atleta,
  nome: ['Fulano', 'Beltrano', 'Ciclano'][index],
}))

assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 8, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 0, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 99, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 3, numero: 4, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 7, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 2, numero: 7, atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 3, numero: 10, atletas: daEquipe, presencas: [] }), null)
assert.match(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 100, atletas: daEquipe, presencas: [] }) ?? '', /0 a 99/)
assert.match(validarTrocaNumeroCamisa({ jogadorId: 1, numero: -1, atletas: daEquipe, presencas: [] }) ?? '', /0 a 99/)
assert.match(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 1.5, atletas: daEquipe, presencas: [] }) ?? '', /0 a 99/)
assert.match(validarTrocaNumeroCamisa({ jogadorId: 1, numero: '7a', atletas: daEquipe, presencas: [] }) ?? '', /0 a 99/)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: '', atletas: daEquipe, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: null, atletas: daEquipe, presencas: [] }), null)
assert.match(validarTrocaNumeroCamisa({ jogadorId: 50, numero: 8, atletas: daEquipe, presencas: [] }) ?? '', /não joga/)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 2, numero: '08', atletas: daEquipe, presencas: [] }), null)
assert.deepEqual(interpretarNumeroCamisa('08'), { numero: 8 })
assert.deepEqual(interpretarNumeroCamisa('00'), { numero: 0 })

const comTroca = [{ jogadorId: 1, equipeId: 10, numero: 12, presente: true }]
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 2, numero: 7, atletas: daEquipe, presencas: comTroca }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 2, numero: 12, atletas: daEquipe, presencas: comTroca }), null)

const passagem = passagemDeNumeroCamisa({ jogadorId: 2, numero: 7, atletas: daEquipe, presencas: [] })
assert.ok(!('erro' in passagem))
if (!('erro' in passagem)) {
  assert.equal(passagem.aviso, 'Camisa 7 passou para Beltrano; Fulano ficou sem número')
  assert.deepEqual(passagem.atribuicoes, [
    { jogadorId: 1, numero: null },
    { jogadorId: 2, numero: 7 },
  ])
}
const semDono = passagemDeNumeroCamisa({ jogadorId: 3, numero: 4, atletas: daEquipe, presencas: [] })
assert.ok(!('erro' in semDono) && semDono.aviso === null && semDono.atribuicoes.length === 1)
const jaVazia = [{ jogadorId: 1, numero: NUMERO_SEM_CAMISA }]
assert.equal(numeroNaPartida({ id: 1, numero: 7 }, jaVazia), null)
assert.equal(numeroNaPartida({ id: 1, numero: 7 }, [{ jogadorId: 1, numero: MARCA_SEM_NUMERO }]), null)
const outraEquipe = passagemDeNumeroCamisa({ jogadorId: 4, numero: 7, atletas: elenco, presencas: [] })
assert.ok(!('erro' in outraEquipe) && outraEquipe.aviso === null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 4, numero: 7, atletas: elenco, presencas: [] }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 8, atletas: elenco, presencas: comTroca }), null)
assert.equal(validarTrocaNumeroCamisa({ jogadorId: 1, numero: 12, atletas: elenco.filter((atleta) => atleta.equipeId === 10), presencas: comTroca }), null)

assert.equal(numeroNaPartida({ id: 1, numero: 7 }, comTroca), 12)
assert.equal(numeroNaPartida({ id: 1, numero: 7 }, []), 7)
assert.equal(numeroNaPartida({ id: 1, numero: 7 }, [{ jogadorId: 1, numero: null }]), 7)
assert.equal(numeroNaPartida({ id: 3, numero: null }, []), null)
assert.equal(numeroNaPartida({ id: 1, numero: '7' }, [{ jogadorId: 1, numero: 0 }]), 0)

const elencoMesa = [{ id: 1 }, { id: 2 }, { id: 3 }]
assert.equal(proximoAtletaNoElenco(elencoMesa, 1)?.id, 2)
assert.equal(proximoAtletaNoElenco(elencoMesa, 3), null)
assert.equal(proximoAtletaNoElenco(elencoMesa, 9), null)
assert.equal(proximoAtletaNoElenco([{ id: 4 }, { id: 5 }], 1), null)

assert.equal(presencaFoiDecidida(null), false)
assert.equal(presencaFoiDecidida({ presente: null }), false)
assert.equal(presencaFoiDecidida({ presente: undefined }), false)
assert.equal(presencaFoiDecidida({ presente: true }), true)
assert.equal(presencaFoiDecidida({ presente: false }), true)

assert.equal(numeroMvpDaLista('1', '21'), '21')
assert.equal(numeroMvpDaLista('1', null), '1')
assert.equal(numeroMvpDaLista('21', '21'), '21')
assert.equal(numeroMvpDaLista('7', '  '), '7')

console.log('numero-camisa-partida ok')
