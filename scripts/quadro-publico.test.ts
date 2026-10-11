import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { abasDaChave, colunasSimetricas, caminhoConector, trechosConectores, vencedorDaPartida } from '../src/lib/chave-visual'
import { liderDaTabela, ordenarScouts, pontosDoAtleta, saldoComSinal, topCinco, type AtletaQuadro, type LinhaGrupo } from '../src/lib/quadro-publico'

const semis = [
  { fase: 'SEMIFINAL', label: 'Semifinal', slots: [{ rodada: 1, avancou: true }, { rodada: 2, avancou: false }] },
  { fase: 'FINAL', label: 'Final', slots: [{ rodada: 1, avancou: true }] },
]
const colunas = colunasSimetricas(semis)
assert.deepEqual(colunas.map((coluna) => coluna.lado), ['esquerda', 'centro', 'direita'])
assert.deepEqual(colunas[0].jogos.map((jogo) => jogo.rodada), [1])
assert.deepEqual(colunas[2].jogos.map((jogo) => jogo.rodada), [2])
assert.deepEqual(abasDaChave(semis).map((aba) => aba.rotulo), ['Semifinal', 'Final'])

const quartas = colunasSimetricas([
  { fase: 'QUARTAS', label: 'Quartas de final', slots: [1, 2, 3, 4].map((rodada) => ({ rodada, avancou: rodada === 1 })) },
  { fase: 'SEMIFINAL', label: 'Semifinal', slots: [{ rodada: 1, avancou: true }, { rodada: 2, avancou: true }] },
  { fase: 'FINAL', label: 'Final', slots: [{ rodada: 1, avancou: false }] },
])
assert.equal(quartas.length, 5)
assert.deepEqual(quartas.map((coluna) => coluna.fase), ['QUARTAS', 'SEMIFINAL', 'FINAL', 'SEMIFINAL', 'QUARTAS'])
assert.deepEqual(quartas[0].jogos.map((jogo) => jogo.rodada), [1, 2])
assert.deepEqual(quartas[4].jogos.map((jogo) => jogo.rodada), [3, 4])
const trechosSemi = trechosConectores(colunas)
assert.equal(trechosSemi.length, 2)
assert.ok(trechosSemi.every((trecho) => trecho.x1 !== trecho.x2 && trecho.y1 === 50 && trecho.y2 === 50))
assert.ok(trechosSemi[0].x2 > trechosSemi[0].x1)
assert.ok(trechosSemi[1].x1 > trechosSemi[1].x2)
assert.equal(trechosSemi.filter((trecho) => trecho.ouro).length, 1)

const trechos = trechosConectores(quartas)
assert.equal(trechos.length, 6)
assert.ok(trechos.every((trecho) => trecho.x1 !== trecho.x2))
assert.equal(trechos.some((trecho) => trecho.ouro), true)
assert.match(caminhoConector(trechos[0]), /^M/)

const jogoEncerrado = { status: 'ENCERRADA', setsPorA: 2, setsPorB: 0, equipeA: { id: 10 }, equipeB: { id: 21 } }
assert.equal(vencedorDaPartida(jogoEncerrado), 10)
assert.equal(vencedorDaPartida({ ...jogoEncerrado, setsPorA: 0, setsPorB: 2 }), 21)
assert.equal(vencedorDaPartida({ ...jogoEncerrado, setsPorA: 1, setsPorB: 1 }), null)
assert.equal(vencedorDaPartida({ ...jogoEncerrado, status: 'EM_ANDAMENTO' }), null)
assert.equal(vencedorDaPartida({ ...jogoEncerrado, status: 'WO', setsPorA: 0, setsPorB: 2 }), 21)
assert.equal(vencedorDaPartida(null), null)

const atletas: AtletaQuadro[] = [
  { jogadorId: 1, nome: 'Ana', equipe: 'Alfa', numero: 10, ataque: 2, bloqueio: 0, saque: 0 },
  { jogadorId: 2, nome: 'Bia', equipe: 'Beta', numero: -1, ataque: 2, bloqueio: 1, saque: 0 },
  { jogadorId: 3, nome: 'Caio', equipe: 'Alfa', numero: null, ataque: 0, bloqueio: 0, saque: 0 },
]
assert.equal(pontosDoAtleta(atletas[1]), 3)
assert.deepEqual(ordenarScouts(atletas).map((item) => item.nome), ['Bia', 'Ana', 'Caio'])
assert.equal(topCinco(atletas, 'ataque')[0].nome, 'Bia')
assert.equal(topCinco(atletas, 'saque').length, 0)

const linhas: LinhaGrupo[] = [
  { posicao: 2, equipe: 'Beta', pontos: 4, jogos: 2, vitorias: 1, derrotas: 1, setsPro: 3, setsContra: 2, saldoSets: 1, pontosPro: 40, pontosContra: 35, saldoPontos: 5, punicoes: 0 },
  { posicao: 1, equipe: 'Alfa', pontos: 6, jogos: 2, vitorias: 2, derrotas: 0, setsPro: 4, setsContra: 1, saldoSets: 3, pontosPro: 50, pontosContra: 30, saldoPontos: 20, punicoes: 1 },
]
assert.equal(liderDaTabela(linhas)?.equipe, 'Alfa')
assert.equal(saldoComSinal(3), '+3')
assert.equal(saldoComSinal(-2), '-2')
assert.equal(liderDaTabela([]), null)

const quadro = readFileSync('src/components/portal/QuadroPublico.tsx', 'utf8')
assert.equal(quadro.includes('setBlocos(null)'), false)
assert.equal(quadro.includes('setAtletas(null)'), false)
assert.equal(quadro.includes('setChave(null)'), false)
assert.match(quadro, /serie === texto\.current/)
assert.match(quadro, /window\.scrollTo\(0, alvo\)/)

const lista = readFileSync('src/components/portal/CampeonatosExpansiveis.tsx', 'utf8')
assert.equal(lista.includes('mi.cartao'), false)
assert.equal(lista.includes('mi.entrar'), false)
assert.match(lista, /window\.scrollY > 24/)
assert.match(lista, /scrollBehavior = 'auto'/)

const chave = readFileSync('src/components/mata-mata/ChaveamentoMataMata.tsx', 'utf8')
assert.match(chave, /useTelaLarga/)
assert.match(chave, /!larga &&/)

console.log('quadro publico ok')
