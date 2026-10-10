import assert from 'node:assert/strict'
import {
  extrairSaquesIniciais,
  ladoOposto,
  marcarSaqueInicial,
  modoSaqueInicial,
  saqueObrigatorio,
  sortearLado,
  validarSaquesIniciais,
  type LadoSaque,
} from '../src/lib/saque-inicial'

const equipes = { teamA: 'Vôlei Ícaro 05', teamB: 'Vôlei Cume 05' }

assert.equal(modoSaqueInicial(1), 'escolha')
assert.equal(modoSaqueInicial(2), 'alternancia')
assert.equal(modoSaqueInicial(3), 'alternancia')
assert.equal(modoSaqueInicial(4), 'alternancia')
assert.equal(modoSaqueInicial(5), 'sorteio')
assert.equal(saqueObrigatorio(2, 'teamA'), 'teamB')
assert.equal(saqueObrigatorio(3, 'teamB'), 'teamA')
assert.equal(saqueObrigatorio(4, 'teamA'), 'teamB')
assert.equal(saqueObrigatorio(1, 'teamA'), null)
assert.equal(saqueObrigatorio(5, 'teamB'), null)
assert.equal(saqueObrigatorio(2, null), null)
assert.equal(ladoOposto('teamA'), 'teamB')
assert.equal(sortearLado(0), 'teamA')
assert.equal(sortearLado(0.49), 'teamA')
assert.equal(sortearLado(0.5), 'teamB')

function ocorrencia(set: number, lado: LadoSaque, nome: string, extra = '') {
  return {
    tipo: 'set_start',
    set,
    descricao: `10:00 | 00 x 00 | Saque inicial: ${nome} começa sacando. ${extra}${marcarSaqueInicial(lado, 1_000 + set)} [[ROT:${2_000 + set}:${lado}:1,2,3,4,5,6:7,8,9,10,11,12]]`,
  }
}

const sequencia = [
  ocorrencia(1, 'teamA', equipes.teamA),
  ocorrencia(2, 'teamB', equipes.teamB),
  ocorrencia(3, 'teamA', equipes.teamA),
  ocorrencia(4, 'teamB', equipes.teamB),
  ocorrencia(5, 'teamA', equipes.teamA, 'Sorteio do tie-break. '),
]
assert.equal(validarSaquesIniciais(sequencia, equipes), null)
assert.deepEqual(extrairSaquesIniciais(sequencia, equipes), {
  1: 'teamA',
  2: 'teamB',
  3: 'teamA',
  4: 'teamB',
  5: 'teamA',
})

assert.match(
  validarSaquesIniciais([
    ocorrencia(1, 'teamA', equipes.teamA),
    ocorrencia(2, 'teamA', equipes.teamA),
  ], equipes) ?? '',
  /set 2/,
)

assert.match(
  validarSaquesIniciais([
    ocorrencia(1, 'teamB', equipes.teamB),
    ocorrencia(2, 'teamA', equipes.teamA),
    ocorrencia(3, 'teamA', equipes.teamA),
  ], equipes) ?? '',
  /set 3/,
)

assert.match(
  validarSaquesIniciais([ocorrencia(2, 'teamB', equipes.teamB)], equipes) ?? '',
  /set 2/,
)

assert.match(
  validarSaquesIniciais([
    ocorrencia(1, 'teamA', equipes.teamA),
    ocorrencia(4, 'teamB', equipes.teamB),
  ], equipes) ?? '',
  /set 4/,
  'set 4 exige o saque do set 3',
)

assert.match(
  validarSaquesIniciais([
    ocorrencia(1, 'teamA', equipes.teamA),
    ocorrencia(2, 'teamB', equipes.teamB),
    ocorrencia(3, 'teamA', equipes.teamA),
    ocorrencia(4, 'teamA', equipes.teamA),
  ], equipes) ?? '',
  /set 4/,
)

const tieBreakIgualAoAnterior = [
  ocorrencia(1, 'teamA', equipes.teamA),
  ocorrencia(2, 'teamB', equipes.teamB),
  ocorrencia(3, 'teamA', equipes.teamA),
  ocorrencia(4, 'teamB', equipes.teamB),
  ocorrencia(5, 'teamB', equipes.teamB),
]
assert.equal(validarSaquesIniciais(tieBreakIgualAoAnterior, equipes), null)

const trocaDeSaque = {
  tipo: 'anotacao',
  set: 1,
  descricao: `10:05 | 01 x 00 | Troca de saque para ${equipes.teamB}. [[ROT:9000:teamB:1,2,3,4,5,6:7,8,9,10,11,12]]`,
}
assert.deepEqual(
  extrairSaquesIniciais([ocorrencia(1, 'teamA', equipes.teamA), trocaDeSaque], equipes),
  { 1: 'teamA' },
)

const notaAntiga = {
  tipo: 'anotacao',
  set: 1,
  descricao: `09:00 | 00 x 00 | Saque inicial: ${equipes.teamB} começa sacando.`,
}
const inicioMaisNovo = {
  tipo: 'set_start',
  set: 1,
  descricao: `10:00 | 00 x 00 | Papeleta confirmada para os dois times. Saque inicial: ${equipes.teamA} começa sacando. ${marcarSaqueInicial('teamA', 5_000)}`,
}
assert.equal(extrairSaquesIniciais([inicioMaisNovo, notaAntiga], equipes)[1], 'teamA')

const nomesParecidos = { teamA: 'Vôlei', teamB: 'Vôlei Cume 05' }
assert.equal(
  extrairSaquesIniciais([{
    tipo: 'anotacao',
    set: 1,
    descricao: 'Saque inicial: Vôlei Cume 05 começa sacando.',
  }], nomesParecidos)[1],
  'teamB',
)

assert.equal(validarSaquesIniciais([], equipes), null)
assert.equal(validarSaquesIniciais(null, equipes), null)

console.log('Saque inicial: escolha no set 1, alternância nos sets 2 a 4 e sorteio livre no 5º.')
