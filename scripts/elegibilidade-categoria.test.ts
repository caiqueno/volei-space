import assert from 'node:assert/strict'
import {
  colunaElegibilidadeAusente,
  mensagemElegibilidade,
  mensagemFaixaIdade,
  normalizarElegibilidade,
  separarElegibilidade,
} from '../src/lib/elegibilidade-categoria'

const hoje = new Date('2026-10-10T12:00:00.000Z')
const feminino = normalizarElegibilidade({ genero: 'FEMININO', idadeMinima: 16, idadeMaxima: 40 })

assert.equal(mensagemElegibilidade(null, { sexo: 'MASCULINO', dataNascimento: '2015-01-01' }, hoje), null)
assert.equal(mensagemElegibilidade(normalizarElegibilidade({}), { sexo: null, dataNascimento: null }, hoje), null)
assert.equal(mensagemElegibilidade(feminino, { sexo: null, dataNascimento: null }, hoje), null)
assert.equal(mensagemElegibilidade(feminino, { sexo: 'FEMININO', dataNascimento: '2000-01-01' }, hoje), null)
assert.match(mensagemElegibilidade(feminino, { sexo: 'MASCULINO' }, hoje) ?? '', /feminino/)
assert.equal(mensagemElegibilidade(normalizarElegibilidade({ genero: 'MISTO' }), { sexo: 'MASCULINO' }, hoje), null)
assert.match(mensagemElegibilidade(feminino, { dataNascimento: '2015-01-01' }, hoje) ?? '', /mínima/)
assert.match(mensagemElegibilidade(feminino, { dataNascimento: '1980-01-01' }, hoje) ?? '', /máxima/)
assert.equal(mensagemElegibilidade(feminino, { dataNascimento: '2008-10-10' }, hoje), null)
assert.match(mensagemElegibilidade(feminino, { dataNascimento: '2010-10-11' }, hoje) ?? '', /mínima/)
assert.equal(mensagemFaixaIdade({ idadeMinima: 40, idadeMaxima: 16 }), 'A idade mínima não pode ser maior que a idade máxima.')
assert.equal(mensagemFaixaIdade({ idadeMinima: 16, idadeMaxima: null }), null)

const separado = separarElegibilidade({ inscricoesAbertas: true, genero: 'MISTO', idadeMinima: 18 })
assert.deepEqual(separado.resto, { inscricoesAbertas: true })
assert.deepEqual(separado.elegibilidade, { genero: 'MISTO', idadeMinima: 18 })
assert.equal(colunaElegibilidadeAusente({ code: 'PGRST204', message: 'Could not find the genero column' }), true)
assert.equal(colunaElegibilidadeAusente({ code: '23514', message: 'outro erro' }), false)

console.log('Elegibilidade passou: gênero, idade e coluna ausente.')
