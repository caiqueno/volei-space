import assert from 'node:assert/strict'
import {
  classificarJogadores,
  fundamentoDoLance,
  numeroDeRanking,
  ordenarJogadores,
  type LanceRanking,
  type LinhaJogadorRanking,
} from '../src/lib/classificacao-jogadores'

function lance(parcial: Partial<LanceRanking> & Pick<LanceRanking, 'tipo'>): LanceRanking {
  return {
    jogadorId: 1,
    descricao: 'lance',
    campeonatoExiste: true,
    ...parcial,
  }
}

assert.equal(fundamentoDoLance(lance({ tipo: 'attack' })), 'ataque')
assert.equal(fundamentoDoLance(lance({ tipo: 'ATAQUE' })), 'ataque')
assert.equal(fundamentoDoLance(lance({ tipo: 'ataque' })), 'ataque')
assert.equal(fundamentoDoLance(lance({ tipo: 'block' })), 'bloqueio')
assert.equal(fundamentoDoLance(lance({ tipo: 'BLOQUEIO' })), 'bloqueio')
assert.equal(fundamentoDoLance(lance({ tipo: 'bloqueio' })), 'bloqueio')
assert.equal(fundamentoDoLance(lance({ tipo: 'ace' })), 'saque')
assert.equal(fundamentoDoLance(lance({ tipo: 'ACE' })), 'saque')
assert.equal(fundamentoDoLance(lance({ tipo: 'saque' })), 'saque')
assert.equal(fundamentoDoLance(lance({ tipo: 'SAQUE' })), 'saque')

assert.equal(fundamentoDoLance(lance({ tipo: 'attack', campeonatoExiste: false })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'attack', jogadorId: null })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'attack', descricao: 'Registro de placar pelo árbitro' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'attack', descricao: 'Lance desfeito pelo árbitro.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'block', descricao: 'Ponto anulado na mesa.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'ace', descricao: 'Lance excluído da súmula.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'point', jogadorId: null, descricao: '+1 — Sem jogador. Ponto para ANGELS sem jogador atribuído.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'point', descricao: '+1 — Sem jogador. Ponto para ANGELS sem jogador atribuído.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'point', descricao: '15:11 | 12 x 13 | +1 — Sem jogador. Ponto para ANGELS sem jogador atribuído.' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'timeout' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'substitution' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'lesao' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'OBSERVACAO', descricao: 'Registro de número de camisa' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'CARTAO_AMARELO' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'anotacao' })), null)
assert.equal(fundamentoDoLance(lance({ tipo: 'system' })), null)

assert.equal(fundamentoDoLance(lance({
  tipo: 'point',
  descricao: '09:10 | 4 x 2 | +1 Ponto de Ataque — Ana. Ataque para TARGET: #10 Ana.',
})), 'ataque')
assert.equal(fundamentoDoLance(lance({ tipo: 'ponto', descricao: 'Ponto direto sem fundamento.' })), 'ponto')
assert.equal(fundamentoDoLance(lance({
  tipo: 'ace',
  jogadorId: 4,
  descricao: '+1 Ponto de Saque — Ana. ACE para TARGET: #-1 Ana.',
})), 'saque')
assert.equal(numeroDeRanking(-1), null)
assert.equal(numeroDeRanking('-1'), null)
assert.equal(numeroDeRanking('sem'), null)
assert.equal(numeroDeRanking(10), 10)
assert.equal(numeroDeRanking(null), null)

const tabela = classificarJogadores(
  [
    { id: 1, nome: 'Ana', equipe: 'Alfa', numero: 10 },
    { id: 2, nome: 'Bruno', equipe: 'Beta', numero: -1 },
    { id: 3, nome: 'Caio', equipe: 'Alfa', numero: 'sem' },
    { id: 4, nome: 'Duda', equipe: 'Gama' },
  ],
  [
    lance({ tipo: 'attack', jogadorId: 1 }),
    lance({ tipo: 'attack', jogadorId: 1, descricao: 'Lance desfeito.' }),
    lance({ tipo: 'block', jogadorId: 2 }),
    lance({ tipo: 'ace', jogadorId: 2 }),
    lance({ tipo: 'attack', jogadorId: 9, campeonatoExiste: false }),
    lance({ tipo: 'point', jogadorId: 4, descricao: 'Ponto de equipe atribuído.' }),
    lance({ tipo: 'timeout', jogadorId: 1 }),
    lance({ tipo: 'point', jogadorId: null, descricao: '+1 — Sem jogador. Ponto para Alfa sem jogador atribuído.' }),
  ],
)

assert.deepEqual(tabela.jogadores.map((linha) => [linha.posicao, linha.nome, linha.total, linha.fundamentos.ataque, linha.fundamentos.bloqueio, linha.fundamentos.saque, linha.fundamentos.ponto]), [
  [1, 'Bruno', 2, 0, 1, 1, 0],
  [2, 'Ana', 1, 1, 0, 0, 0],
  [3, 'Duda', 1, 0, 0, 0, 1],
  [4, 'Caio', 0, 0, 0, 0, 0],
])
assert.deepEqual(tabela.fundamentos.map((coluna) => coluna.id), ['ataque', 'bloqueio', 'saque', 'ponto'])
assert.equal(tabela.jogadores.find((linha) => linha.nome === 'Caio')?.equipe, 'Alfa')
assert.equal(tabela.jogadores.find((linha) => linha.nome === 'Ana')?.numero, 10)
assert.equal(tabela.jogadores.find((linha) => linha.nome === 'Bruno')?.numero, null)
assert.equal(tabela.jogadores.find((linha) => linha.nome === 'Caio')?.numero, null)
const comCamisaVazia = classificarJogadores(
  [{ id: 4, nome: 'Ana', equipe: 'TARGET', numero: -1 }],
  [lance({ tipo: 'ace', jogadorId: 4, descricao: 'ACE para TARGET: #-1 Ana.' })],
)
assert.equal(comCamisaVazia.jogadores.length, 1)
assert.equal(comCamisaVazia.jogadores[0].jogadorId, 4)
assert.equal(comCamisaVazia.jogadores[0].total, 1)
assert.equal(comCamisaVazia.jogadores[0].numero, null)

const empate = classificarJogadores(
  [
    { id: 1, nome: 'Eva', equipe: 'A' },
    { id: 2, nome: 'Fábio', equipe: 'B' },
    { id: 3, nome: 'Duda', equipe: 'C' },
    { id: 4, nome: 'Helô', equipe: 'D' },
    { id: 5, nome: 'Gina', equipe: 'E' },
    { id: 6, nome: 'Igor', equipe: 'F' },
    { id: 7, nome: 'João', equipe: 'G' },
  ],
  [
    lance({ tipo: 'attack', jogadorId: 1 }),
    lance({ tipo: 'block', jogadorId: 2 }),
    lance({ tipo: 'ace', jogadorId: 3 }),
    lance({ tipo: 'attack', jogadorId: 4 }),
    lance({ tipo: 'attack', jogadorId: 5 }),
    lance({ tipo: 'attack', jogadorId: 6 }),
    lance({ tipo: 'attack', jogadorId: 6 }),
    lance({ tipo: 'attack', jogadorId: 7 }),
    lance({ tipo: 'block', jogadorId: 7 }),
  ],
)
assert.deepEqual(empate.jogadores.map((linha) => linha.nome), ['Igor', 'João', 'Eva', 'Gina', 'Helô', 'Fábio', 'Duda'])

const porAtaque = ordenarJogadores(empate.jogadores, 'ataque', 'desc')
assert.equal(porAtaque[0].nome, 'Igor')
assert.equal(porAtaque[0].posicao, 1)
assert.equal(porAtaque.find((linha) => linha.nome === 'Duda')?.posicao, 7)

const porNome = ordenarJogadores(empate.jogadores, 'nome', 'asc')
assert.deepEqual(porNome.map((linha) => linha.nome), ['Duda', 'Eva', 'Fábio', 'Gina', 'Helô', 'Igor', 'João'])
assert.deepEqual(ordenarJogadores(empate.jogadores, 'posicao', 'asc').map((linha) => linha.posicao), [1, 2, 3, 4, 5, 6, 7])

const vazia = classificarJogadores([{ id: 8, nome: '  ', equipe: '  ' }], [])
assert.equal(vazia.jogadores[0].nome, 'Atleta')
assert.equal(vazia.jogadores[0].equipe, 'Equipe')
assert.equal(vazia.jogadores[0].total, 0)
assert.equal(vazia.fundamentos.some((coluna) => coluna.id === 'ponto'), false)

function linha(parcial: Partial<LinhaJogadorRanking> & Pick<LinhaJogadorRanking, 'nome' | 'posicao'>): LinhaJogadorRanking {
  return {
    jogadorId: parcial.posicao,
    equipe: 'A',
    numero: null,
    fundamentos: { ataque: 0, bloqueio: 0, saque: 0 },
    total: 0,
    ...parcial,
  }
}

const porEquipe = ordenarJogadores([
  linha({ posicao: 2, nome: 'Bia', equipe: 'Zulu' }),
  linha({ posicao: 1, nome: 'Ana', equipe: 'Alfa' }),
], 'equipe', 'asc')
assert.deepEqual(porEquipe.map((item) => item.equipe), ['Alfa', 'Zulu'])

console.log('classificacao jogadores ok')
