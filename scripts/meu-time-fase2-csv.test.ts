import assert from 'node:assert/strict'
import { analisarCsv, detectarSeparador, normalizarData } from '../src/lib/meu-time-fase2/csv'

const HOJE = new Date('2026-10-17T12:00:00Z')

function ok(texto: string) {
  const r = analisarCsv(texto, HOJE)
  assert.equal(r.ok, true, JSON.stringify(r))
  if (!r.ok) throw new Error('x')
  return r
}

// Separadores e BOM
assert.equal(detectarSeparador('nome;nascimento\nA;01/01/2000'), ';')
assert.equal(detectarSeparador('nome,nascimento\n"A;B",01/01/2000'), ',')
let r = ok('﻿nome;nascimento;camisa;posicao;responsavel_contato\nAna Souza;15/03/1998;7;op;\n')
assert.equal(r.linhas.length, 1)
assert.equal(r.linhas[0].status, 'OK')
assert.deepEqual(r.linhas[0].dados, { nome: 'Ana Souza', dataNascimento: '1998-03-15', numeroPreferido: 7, posicao: 'OP', menor: false, temResponsavelContato: false })

// Datas
assert.equal(normalizarData('5/3/2000'), '2000-03-05')
assert.equal(normalizarData('2000-03-05'), '2000-03-05')
assert.equal(normalizarData('2000/03/05'), null)
r = ok('nome,nascimento\nA B,31/02/2000\nC D,2000-13-01\nE F,\nG H,2999-01-01')
assert.deepEqual(r.linhas.map((l) => l.status), ['ERRO', 'ERRO', 'ERRO', 'ERRO'])
assert.deepEqual(r.resumo, { validas: 0, comAviso: 0, invalidas: 4 })

// Aspas: vírgula, aspas escapadas e quebra de linha dentro do campo
r = ok('nome,nascimento,camisa\r\n"Silva, João ""Jota""",2000-01-02,10\r\n"Maria\nLuiza",03/04/1999,11\r\n')
assert.equal(r.linhas[0].dados.nome, 'Silva, João "Jota"')
assert.equal(r.linhas[1].dados.nome, 'Maria Luiza')
assert.equal(r.linhas[1].n, 2)

// Camisa duplicada vira AVISO; camisa inválida vira ERRO
r = ok('nome,nascimento,camisa\nA Um,2000-01-01,9\nB Dois,2000-01-02,9\nC Tres,2000-01-03,100\nD Quatro,2000-01-04,x')
assert.deepEqual(r.linhas.map((l) => l.status), ['OK', 'AVISO', 'ERRO', 'ERRO'])
assert.match(r.linhas[1].avisos[0], /Camisa 9 repetida/)

// Menor de idade: AVISO, contato nunca devolvido
r = ok('nome,nascimento,responsavel_contato\nJoana Menor,2012-05-01,11999990000')
assert.equal(r.linhas[0].status, 'AVISO')
assert.equal(r.linhas[0].dados.menor, true)
assert.equal(r.linhas[0].dados.temResponsavelContato, true)
assert.ok(!JSON.stringify(r).includes('11999990000'))
assert.ok(r.linhas[0].avisos.some((a) => a.includes('ATLETA_MENOR_SEM_CONSENTIMENTO')))

// Repetido na planilha; posição desconhecida; fórmula no nome
r = ok('nome,nascimento,posicao\nAna Lima,2000-01-01,ZZ\nana lima,2000-01-01,\n=CMD Fulano,2000-02-02,')
assert.equal(r.linhas[0].status, 'AVISO')
assert.equal(r.linhas[0].dados.posicao, null)
assert.equal(r.linhas[1].repetida, true)
assert.equal(r.linhas[2].dados.nome, 'CMD Fulano')

// Cabeçalho ausente, vazio e limite de 60 linhas
for (const [texto, codigo] of [['', 'CSV_VAZIO'], ['Ana,2000-01-01', 'CSV_SEM_CABECALHO'], ['nome,nascimento', 'CSV_VAZIO']] as const) {
  const x = analisarCsv(texto, HOJE)
  assert.equal(x.ok, false)
  if (!x.ok) assert.equal(x.codigo, codigo)
}
const sessenta = Array.from({ length: 60 }, (_, i) => `Atleta ${String.fromCharCode(65 + (i % 26))}${i},2000-01-01`)
assert.equal(analisarCsv(['nome,nascimento', ...sessenta].join('\n'), HOJE).ok, true)
const x61 = analisarCsv(['nome,nascimento', ...sessenta, 'Mais Um,2000-01-01'].join('\n'), HOJE)
assert.equal(x61.ok, false)

console.log('meu-time-fase2-csv ok')
