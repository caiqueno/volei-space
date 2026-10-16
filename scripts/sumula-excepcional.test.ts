import assert from 'node:assert/strict'
import { validarSubstituicoes } from '../src/lib/sumula-regras'

const equipes = [{ id: 1, nome: 'Alfa' }, { id: 2, nome: 'Beta' }]
const jogadorEquipe = new Map([[10, 1]])

function troca(tipo: string, saiu: number, entrou: number, marcador = '') {
  return {
    tipo,
    set: 1,
    jogadorId: 10,
    descricao: `10:00 | 1x0 | Substituição Alfa: sai #${saiu} A, entra #${entrou} B.${marcador}`,
  }
}

const seis = [1, 2, 3, 4, 5, 6].map((n) => troca('substitution', n, n + 20))
const base = { equipes, jogadorEquipe, limite: 6, substituicaoPorLesao: false }

// M1: a 7ª troca excepcional marcada pela tela não conta na cota regular
assert.equal(validarSubstituicoes({ ...base, ocorrencias: [...seis, troca('lesao', 7, 27, ' [[EXC:EXPULSAO]]')] }), null)
for (const motivo of ['LESAO', 'DOENCA', 'EXPULSAO', 'DESQUALIFICACAO']) {
  assert.equal(validarSubstituicoes({ ...base, ocorrencias: [...seis, troca('injury_substitution', 7, 27, ` [[EXC:${motivo}]]`)] }), null, motivo)
}
// Não cria par: o atleta que saiu na cota regular pode ser trocado de forma excepcional
assert.equal(validarSubstituicoes({ ...base, ocorrencias: [troca('substitution', 1, 21), troca('lesao', 21, 30, ' [[EXC:LESAO]]')] }), null)
// Troca de líbero continua fora da cota
assert.equal(validarSubstituicoes({ ...base, ocorrencias: [...seis, troca('libero_exchange', 7, 27)] }), null)
// Sem marcador, o comportamento anterior se mantém
assert.match(validarSubstituicoes({ ...base, ocorrencias: [...seis, troca('lesao', 7, 27)] }) ?? '', /limite de 6/)
assert.equal(validarSubstituicoes({ ...base, substituicaoPorLesao: true, ocorrencias: [...seis, troca('lesao', 7, 27)] }), null)
// A 7ª regular segue recusada, mesmo com excepcional marcada antes
assert.match(validarSubstituicoes({ ...base, ocorrencias: [troca('lesao', 9, 29, ' [[EXC:LESAO]]'), ...seis, troca('substitution', 7, 27)] }) ?? '', /limite de 6/)
// Marcador em troca regular não a isenta
assert.match(validarSubstituicoes({ ...base, ocorrencias: [...seis, troca('substitution', 7, 27, ' [[EXC:LESAO]]')] }) ?? '', /limite de 6/)

console.log('sumula-excepcional.test.ts ok')
