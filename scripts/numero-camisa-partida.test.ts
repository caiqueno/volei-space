import assert from 'node:assert/strict'
import {
  MARCA_SEM_NUMERO,
  NUMERO_SEM_CAMISA,
  interpretarNumeroCamisa,
  numeroHerdado,
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

const anteriores = [
  { jogadorId: 1, partidaId: 10, ligaId: 3, numero: 8, dataHora: '2026-09-01T12:00:00.000Z', presencaId: 1 },
  { jogadorId: 1, partidaId: 11, ligaId: 3, numero: 13, dataHora: '2026-10-01T12:00:00.000Z', presencaId: 2 },
  { jogadorId: 1, partidaId: 12, ligaId: 3, numero: null, dataHora: '2026-10-05T12:00:00.000Z', presencaId: 3 },
  { jogadorId: 1, partidaId: 20, ligaId: 9, numero: 99, dataHora: '2026-10-08T12:00:00.000Z', presencaId: 4 },
  { jogadorId: 2, partidaId: 11, ligaId: 3, numero: 4, dataHora: '2026-10-01T12:00:00.000Z', presencaId: 5 },
  { jogadorId: 1, partidaId: 30, ligaId: 3, numero: 21, dataHora: null, presencaId: 9 },
]
const base = { jogadorId: 1, ligaId: 3, partidaAtualId: 40, numeroCadastro: 7, anteriores }
assert.equal(numeroHerdado({ ...base, numeroDesteJogo: null }), 13)
assert.equal(numeroHerdado({ ...base, numeroDesteJogo: 0 }), 0)
assert.equal(numeroHerdado({ ...base, numeroDesteJogo: NUMERO_SEM_CAMISA }), NUMERO_SEM_CAMISA)
assert.equal(numeroHerdado({ ...base, numeroDesteJogo: 13 }), 13)
assert.equal(numeroHerdado({
  ...base,
  numeroDesteJogo: null,
  anteriores: [...anteriores, { jogadorId: 1, partidaId: 40, ligaId: 3, numero: 5, dataHora: '2026-10-10T12:00:00.000Z', presencaId: 8 }],
}), 13)
assert.equal(numeroHerdado({
  jogadorId: 1,
  ligaId: 3,
  partidaAtualId: 40,
  numeroCadastro: 7,
  numeroDesteJogo: null,
  anteriores: [{ jogadorId: 1, partidaId: 15, ligaId: 3, numero: NUMERO_SEM_CAMISA, dataHora: '2026-10-02T12:00:00.000Z', presencaId: 6 }],
}), NUMERO_SEM_CAMISA)
assert.equal(numeroHerdado({ jogadorId: 8, ligaId: 3, partidaAtualId: 40, numeroCadastro: null, numeroDesteJogo: null, anteriores }), null)
assert.equal(numeroHerdado({ jogadorId: 8, ligaId: 3, partidaAtualId: 40, numeroCadastro: 4, numeroDesteJogo: null, anteriores }), 4)
assert.equal(numeroHerdado({
  jogadorId: 1,
  ligaId: 3,
  partidaAtualId: 40,
  numeroCadastro: 7,
  numeroDesteJogo: null,
  anteriores: [
    { jogadorId: 1, partidaId: 2, ligaId: 3, numero: 1, dataHora: '2026-08-01T12:00:00.000Z', presencaId: 1 },
    { jogadorId: 1, partidaId: 9, ligaId: 3, numero: 2, dataHora: '2026-08-01T12:00:00.000Z', presencaId: 2 },
  ],
}), 2)
assert.equal(numeroHerdado({
  jogadorId: 1,
  ligaId: 3,
  partidaAtualId: 40,
  numeroCadastro: 7,
  numeroDesteJogo: null,
  anteriores: [
    { jogadorId: 1, partidaId: 9, ligaId: 3, numero: 2, dataHora: '2026-08-01T12:00:00.000Z', presencaId: 2 },
    { jogadorId: 1, partidaId: 9, ligaId: 3, numero: 6, dataHora: '2026-08-01T12:00:00.000Z', presencaId: 7 },
  ],
}), 6)

assert.equal(numeroNaPartida({ id: 1, numero: 7, numeroHerdado: 13 }, [{ jogadorId: 1, numero: null }]), 13)
assert.equal(numeroNaPartida({ id: 1, numero: 7, numeroHerdado: 13 }, [{ jogadorId: 1, numero: 0 }]), 0)
assert.equal(numeroNaPartida({ id: 1, numero: 7, numeroHerdado: 13 }, [{ jogadorId: 1, numero: NUMERO_SEM_CAMISA }]), null)
assert.equal(numeroNaPartida({ id: 1, numero: 7, numeroHerdado: NUMERO_SEM_CAMISA }, []), null)
assert.equal(numeroNaPartida({ id: 1, numero: 7 }, []), 7)

console.log('numero-camisa-partida ok')
