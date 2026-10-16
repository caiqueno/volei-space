import assert from 'node:assert/strict'
import { montarSumulaImpressa, urlDeConsulta } from '../src/lib/sumula-impressa/montar'
import { duracaoEntre, ehObservacao, ehSancao, lerRotacao, partesDaDescricao } from '../src/lib/sumula-impressa/interpretar'
import type { RegistroSumula } from '../src/lib/sumula-impressa/tipos'

const jog = (id: number, nome: string, numero: number, posicao: string | null = null) => ({ id, nome, numero, posicao })
const A = [jog(1, 'Ana', 1), jog(2, 'Bia', 2), jog(3, 'Cris', 3), jog(4, 'Dani', 4), jog(5, 'Eva', 5), jog(6, 'Fa', 6), jog(7, 'Gi', 7, 'Líbero')]
const B = [jog(11, 'Lia', 1), jog(12, 'Mel', 2), jog(13, 'Nina', 3), jog(14, 'Ola', 4), jog(15, 'Pri', 5), jog(16, 'Quel', 6), jog(17, 'Rô', 8)]

const registro: RegistroSumula = {
  id: 10,
  status: 'ENCERRADA',
  categoria: 'Adulto',
  dataHora: '2026-05-10T15:00:00.000Z',
  localNome: 'Ginásio',
  setsPorA: 2,
  setsPorB: 0,
  vencedorId: 100,
  liga: { nome: 'Copa Teste' },
  equipeA: { id: 100, nome: 'Alfa', jogadores: A },
  equipeB: { id: 200, nome: 'Beta', jogadores: B },
  sets: [{ numero: 2, pontosA: 25, pontosB: 20 }, { numero: 1, pontosA: 25, pontosB: 18 }],
  presencas: [
    ...A.map((j) => ({ presente: true, equipeId: 100, jogadorId: j.id, numero: j.id === 1 ? 10 : null })),
    ...B.map((j) => ({ presente: true, equipeId: 200, jogadorId: j.id, numero: null })),
  ],
  escala: [{ cargo: 'PRIMEIRO', arbitro: { nome: 'Juiz Um' } }],
  destaques: [{ tipo: 'MVP', jogador: { id: 1, nome: 'Ana' } }],
  ocorrencias: [
    { id: 1, tipo: 'anotacao', set: 1, descricao: '14:00 | 0-0 | Capitães da partida: Alfa #2 Bia e Beta #3 Nina.' },
    { id: 2, tipo: 'set_start', set: 1, descricao: '14:01 | 0-0 | Papeleta do set 1 confirmada para os dois times. Líberos iniciais: Alfa #7 e Beta nenhum. Saque inicial: Beta começa sacando. [[ROT:1:teamB:10,3,2,4,5,6:11,12,13,14,15,16]]' },
    { id: 3, tipo: 'timeout', set: 1, descricao: '14:10 | 8-5 | Tempo técnico solicitado por Alfa (1/2 no set 1).' },
    { id: 4, tipo: 'substitution', set: 1, descricao: '14:12 | 10-6 | Substituição Beta: sai #6 Quel, entra #8 Rô. [[ROT:2:teamB:1,1,1,1,1,1:1,1,1,1,1,1]]' },
    { id: 5, tipo: 'troca_libero', set: 1, descricao: '14:13 | 11-6 | Troca de líbero Alfa: sai #7 Gi, entra #3 Cris.' },
    { id: 6, tipo: 'CARTAO_AMARELO', set: 1, descricao: '14:15 | 12-6 | [Cartão amarelo] Beta - Ola: reclamação' },
    { id: 7, tipo: 'anotacao', set: 1, descricao: '14:16 | 12-6 | Formação da quadra atualizada. [[ROT:3:teamB:1,1,1,1,1,1:1,1,1,1,1,1]]' },
    { id: 8, tipo: 'OBSERVACAO', set: 1, descricao: '14:17 | 12-6 | Bola trocada por desgaste.' },
    { id: 9, tipo: 'set_end', set: 1, descricao: '14:25 | 25-18 | Set 1 encerrado.' },
    { id: 10, tipo: 'set_start', set: 2, descricao: '23:50 | 0-0 | Papeleta do set 2. Líberos iniciais: Alfa nenhum e Beta nenhum. [[ROT:9:teamA:1,2,3,4,5,6:11,12,13,14,15,16]]' },
    { id: 11, tipo: 'set_end', set: 2, descricao: '00:10 | 25-20 | Set 2 encerrado.' },
  ],
}

const m = montarSumulaImpressa(registro)!
assert.ok(m)
assert.equal(m.equipeA.nome, 'ALFA')
assert.equal(m.campeonato, 'Copa Teste')
assert.deepEqual(m.arbitros, [{ cargo: 'PRIMEIRO', nome: 'Juiz Um' }])
assert.deepEqual(m.sets.map((s) => s.numero), [1, 2])

// camisa do jogo (presença) prevalece no relatório; capitão e líbero marcados
const ana = m.equipeA.atletas.find((a) => a.jogadorId === 1)!
assert.equal(ana.camisa, '10')
assert.equal(m.equipeA.atletas.find((a) => a.nome === 'Bia')!.capitao, true)
assert.equal(m.equipeB.atletas.find((a) => a.nome === 'Nina')!.capitao, true)
assert.equal(m.equipeA.atletas.find((a) => a.nome === 'Gi')!.libero, true)
assert.equal(m.equipeA.atletas.find((a) => a.nome === 'Cris')!.libero, true) // entrou por troca de líbero

// formação inicial e sacador vêm do set_start (não da atualização posterior)
const s1 = m.sets[0]
assert.equal(s1.sacador, 'B')
assert.deepEqual(s1.formacaoA!.map((p) => p.posicao), ['IV', 'III', 'II', 'V', 'VI', 'I'])
assert.deepEqual(s1.formacaoA!.map((p) => p.camisa), ['10', '3', '2', '4', '5', '6'])
assert.equal(s1.liberoA, '#7 Gi')
assert.equal(s1.liberoB, null)

// tempos e substituições em ordem, com placar; marcas técnicas somem do texto
assert.equal(s1.tempos.length, 1)
assert.equal(s1.tempos[0].placar, '8-5')
assert.equal(s1.tempoA, 1)
assert.equal(s1.tempoB, 0)
assert.deepEqual(s1.substituicoes.map((e) => e.id), [4, 5])
assert.ok(!s1.substituicoes[0].texto.includes('[['))
assert.equal(s1.substB, 1)
assert.equal(s1.substA, 0) // troca de líbero não conta como substituição regular

// sanções e observações; texto técnico fica de fora
assert.deepEqual(m.sancoes.map((e) => e.id), [6])
assert.equal(m.sancoes[0].lado, 'B')
assert.deepEqual(m.observacoes.map((e) => e.id), [8])

// duração (inclusive virada de meia-noite) e totais
assert.equal(s1.duracaoMin, 24)
assert.equal(m.sets[1].duracaoMin, 20)
assert.equal(m.duracaoTotalMin, 44)
assert.equal(m.totalPontosA, 50)
assert.equal(m.totalPontosB, 38)
assert.equal(m.vencedor, 'ALFA')
assert.deepEqual(m.mvp, ['Ana'])

// sem dados: nada é inventado
const vazio = montarSumulaImpressa({ ...registro, ocorrencias: [], destaques: [], escala: [], vencedorId: null, presencas: [] })!
assert.equal(vazio.sets[0].formacaoA, null)
assert.equal(vazio.sets[0].sacador, null)
assert.equal(vazio.sets[0].duracaoMin, null)
assert.equal(vazio.duracaoTotalMin, null)
assert.equal(vazio.vencedor, null)
assert.deepEqual(vazio.mvp, [])
assert.equal(vazio.equipeA.atletas.some((a) => a.capitao), false)
assert.equal(montarSumulaImpressa({ ...registro, equipeB: null }), null)

// utilitários
assert.equal(duracaoEntre('23:50', '00:10'), 20)
assert.equal(duracaoEntre(null, '10:00'), null)
assert.deepEqual(partesDaDescricao('a | b | c | d'), { hora: 'a', placar: 'b', texto: 'c | d' })
assert.equal(lerRotacao('x [[ROT:1:teamA:1,2:3,4]]')?.lado, 'A')
assert.equal(lerRotacao('sem marca'), null)
assert.equal(ehSancao({ tipo: 'anotacao', descricao: '1 | 0-0 | [Sanção] A - B: x' }), true)
assert.equal(ehObservacao({ tipo: 'anotacao', descricao: '1 | 0-0 | Saque inicial: A começa sacando.' }), false)

// acesso: mesmas rotas da súmula (token opaco ou id pela rota pública)
assert.equal(urlDeConsulta('abc_DEF-1'), '/api/sumula/abc_DEF-1?consulta=1')
assert.equal(urlDeConsulta('123'), '/api/partidas/123/sumula-publica')
assert.equal(urlDeConsulta('a/b'), '/api/sumula/a%2Fb?consulta=1')

console.log('sumula-impressa: ok')
