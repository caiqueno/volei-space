import assert from 'node:assert/strict'
import {
  aplicarSubstituicao,
  controleVazio,
  mensagemFalhaSubstituicao,
  reservasElegiveis,
  textoAvisoSubstituicao,
  validarSubstituicoes,
} from '../src/lib/sumula-regras'

const equipes = [{ id: 1, nome: 'Alpha' }, { id: 2, nome: 'Bravo' }]
const substituicao = (set: number, nome: string, saiu: number | string, entrou: number | string) => ({
  tipo: 'substitution',
  set,
  descricao: `Substituição ${nome}: sai #${saiu}, entra #${entrou}.`,
})

assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: Array.from({ length: 8 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
}), null)
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: Array.from({ length: 9 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
}) ?? '', /8 substituições/)
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    ...Array.from({ length: 8 }, (_, indice) => substituicao(1, 'Alpha', indice + 1, indice + 11)),
    { tipo: 'troca_libero', set: 1, descricao: 'Troca de líbero Alpha: sai #15, entra #16.' },
    { tipo: 'libero_exchange', set: 1, descricao: 'Troca de líbero Alpha: sai #16, entra #15.' },
  ],
}), null, 'líbero não consome a cota nem cria par')

assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Alpha', 9, 12),
  ],
}) ?? '', /par já formado/)
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    { tipo: 'libero_exchange', set: 1, descricao: 'Troca de líbero Alpha: sai #8, entra #16.' },
    substituicao(1, 'Alpha', 9, 5),
  ],
}), null, 'a volta do titular continua válida depois de uma troca de líbero')
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Alpha', 9, 5),
    substituicao(1, 'Alpha', 5, 9),
  ],
}) ?? '', /já voltou/)
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Alpha', 9, 5),
    substituicao(1, 'Alpha', 5, 12),
  ],
}) ?? '', /já voltou/)
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Alpha', 9, 5),
    substituicao(1, 'Alpha', 1, 9),
  ],
}) ?? '', /já voltou/)
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Alpha', 9, 5),
    substituicao(2, 'Alpha', 5, 12),
  ],
}), null, 'o vínculo zera no set seguinte')
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 5, 9),
    substituicao(1, 'Bravo', 5, 12),
    substituicao(1, 'Alpha', 1, 10),
  ],
}), null, 'cada equipe tem o próprio vínculo')
assert.equal(validarSubstituicoes({
  equipes,
  ocorrencias: [
    substituicao(1, 'Alpha', 9, 5),
    substituicao(1, 'Alpha', 5, 9),
  ],
}), null, 'a volta gravada antes da entrada, na ordem da súmula, continua válida')
assert.match(validarSubstituicoes({
  equipes,
  ocorrencias: [
    { tipo: 'substitution', set: 1, descricao: 'Substituição Alpha: sai #5 Ana Costa, entra #9 Bruno Lima.' },
    { tipo: 'substitution', set: 1, descricao: 'Substituição Alpha: sai #9 Bruno Lima, entra #5 Ana Costa.' },
    { tipo: 'substitution', set: 1, descricao: 'Substituição Alpha: sai #5 Ana Costa, entra #9 Bruno Lima.' },
  ],
}) ?? '', /já voltou/)

let controle = controleVazio()
let lista = reservasElegiveis(controle, '5', ['7', '9', '10', '11'])
assert.deepEqual(lista.numeros, ['7', '9', '10', '11'])
assert.equal(lista.aviso, null)

let passo = aplicarSubstituicao(controle, '5', '9')
assert.equal(passo.falha, null)
controle = passo.controle
lista = reservasElegiveis(controle, '9', ['5', '7', '10', '11'])
assert.deepEqual(lista.numeros, ['5'])
assert.equal(lista.aviso && textoAvisoSubstituicao(lista.aviso), 'Neste set, #9 só pode sair para #5 voltar.')
lista = reservasElegiveis(controle, '1', ['7', '10', '11', '5'])
assert.deepEqual(lista.numeros, ['7', '10', '11'])
assert.ok(!lista.numeros.includes('5'))

passo = aplicarSubstituicao(controle, '9', '7')
assert.equal(passo.falha, 'par')
assert.equal(controle.pares[0]?.fechado, false)

passo = aplicarSubstituicao(controle, '9', '5')
assert.equal(passo.falha, null)
controle = passo.controle
assert.equal(controle.pares[0]?.fechado, true)
lista = reservasElegiveis(controle, '5', ['7', '9', '10', '11'])
assert.deepEqual(lista.numeros, [])
assert.match(lista.aviso ? textoAvisoSubstituicao(lista.aviso) : '', /#5 já voltou no lugar de #9/)
lista = reservasElegiveis(controle, '1', ['7', '9', '10', '11'])
assert.deepEqual(lista.numeros, ['7', '10', '11'])
assert.equal(aplicarSubstituicao(controle, '5', '9').falha, 'par_fechado')
assert.equal(aplicarSubstituicao(controle, '1', '9').falha, 'par_fechado')

const outroSet = controleVazio()
assert.equal(aplicarSubstituicao(outroSet, '5', '12').falha, null)

let cheio = controleVazio()
for (let indice = 0; indice < 8; indice += 1) {
  const resultado = aplicarSubstituicao(cheio, String(indice + 1), String(indice + 20))
  assert.equal(resultado.falha, null)
  cheio = resultado.controle
}
assert.equal(aplicarSubstituicao(cheio, '9', '30').falha, 'limite')
assert.equal(reservasElegiveis(cheio, '1', ['30']).aviso?.tipo, 'limite')
assert.match(mensagemFalhaSubstituicao('limite', 3), /set 3/)

console.log('Substituição por set: par fecha na volta, reserva elegível e líbero fora da cota.')
