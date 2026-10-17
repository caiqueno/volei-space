import {
  anexarEvento,
  calcularFechamento,
  CONFIG_FIVB_MELHOR_DE_5,
  validarAssinaturasFechamento,
  validarFechamentoComAssinaturas,
  type AssinaturaFechamento,
  type NovoEvento,
  type SumulaEvento,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const apontador: AssinaturaFechamento = { papel: 'APONTADOR', ordem: 1 }
const capA: AssinaturaFechamento = { papel: 'CAPITAO', equipe: 'A', situacao: 'PRESENTE', ordem: 2 }
const capB: AssinaturaFechamento = { papel: 'CAPITAO', equipe: 'B', situacao: 'PRESENTE', ordem: 3 }
const arbitro: AssinaturaFechamento = { papel: 'ARBITRO', funcao: 'PRIMEIRO', ordem: 4 }

function codigo(r: ReturnType<typeof validarAssinaturasFechamento>): string | null {
  return r.ok ? null : r.codigo
}

caso('RG-FEC-002: apontador, depois capitães, depois árbitros é a ordem válida', () => {
  assert.equal(validarAssinaturasFechamento([apontador, capA, capB, arbitro]).ok, true)
  // A ordem vale pela posição informada, não pela ordem do array.
  assert.equal(validarAssinaturasFechamento([arbitro, capB, apontador, capA]).ok, true)
})

caso('RG-FEC-002: capitão que assina antes do apontador, ou árbitro antes do capitão, é recusado', () => {
  const antes = validarAssinaturasFechamento([{ ...capA, ordem: 1 }, { ...apontador, ordem: 2 }, capB, arbitro])
  assert.equal(codigo(antes), 'RG-FEC-002')
  const arbitroCedo = validarAssinaturasFechamento([apontador, capA, { ...arbitro, ordem: 3 }, { ...capB, ordem: 4 }])
  assert.equal(codigo(arbitroCedo), 'RG-FEC-002')
})

caso('RG-FEC-002: faltando apontador, árbitro ou capitão de uma equipe, o fechamento não vale', () => {
  assert.equal(codigo(validarAssinaturasFechamento([capA, capB, arbitro])), 'RG-FEC-002')
  assert.equal(codigo(validarAssinaturasFechamento([apontador, capA, capB])), 'RG-FEC-002')
  assert.equal(codigo(validarAssinaturasFechamento([apontador, capA, arbitro])), 'RG-FEC-002')
})

caso('RG-FEC-002: posições de ordem repetidas ou inválidas são recusadas', () => {
  assert.equal(codigo(validarAssinaturasFechamento([apontador, capA, { ...capB, ordem: 2 }, arbitro])), 'RG-FEC-002')
  assert.equal(codigo(validarAssinaturasFechamento([{ ...apontador, ordem: 0 }, capA, capB, arbitro])), 'RG-FEC-002')
})

caso('RG-FEC-003: capitão ausente é substituído pelo capitão em jogo, com observação do fato', () => {
  const ausente: AssinaturaFechamento = {
    papel: 'CAPITAO',
    equipe: 'A',
    situacao: 'AUSENTE_SUBSTITUIDO',
    jogadorId: 7,
    observacao: 'Capitão nº 1 deixou o ginásio por lesão.',
    ordem: 2,
  }
  assert.equal(validarAssinaturasFechamento([apontador, ausente, capB, arbitro], { capitaesEmJogo: { A: 7, B: 11 } }).ok, true)
  // Quem assina precisa ser o capitão em jogo.
  assert.equal(codigo(validarAssinaturasFechamento([apontador, { ...ausente, jogadorId: 9 }, capB, arbitro], { capitaesEmJogo: { A: 7, B: 11 } })), 'RG-FEC-003')
  // Sem observação ou sem o jogador que assinou, não vale.
  assert.equal(codigo(validarAssinaturasFechamento([apontador, { ...ausente, observacao: '  ' }, capB, arbitro])), 'RG-FEC-003')
  const { jogadorId: _omitido, ...semJogador } = ausente
  assert.equal(codigo(validarAssinaturasFechamento([apontador, semJogador as AssinaturaFechamento, capB, arbitro])), 'RG-FEC-003')
})

caso('RG-FEC-003: capitão que recusa deixa o campo em branco e o motivo na observação', () => {
  const recusa: AssinaturaFechamento = { papel: 'CAPITAO', equipe: 'B', situacao: 'RECUSA', observacao: 'Discorda do resultado.', ordem: 3 }
  assert.equal(validarAssinaturasFechamento([apontador, capA, recusa, arbitro]).ok, true)
  assert.equal(codigo(validarAssinaturasFechamento([apontador, capA, { ...recusa, observacao: '' }, arbitro])), 'RG-FEC-003')
})

caso('RG-FEC-003: a recusa não conta na ordem de assinatura (campo em branco)', () => {
  const recusa: AssinaturaFechamento = { papel: 'CAPITAO', equipe: 'B', situacao: 'RECUSA', observacao: 'Motivo registrado.', ordem: 9 }
  assert.equal(validarAssinaturasFechamento([apontador, capA, recusa, { ...arbitro, ordem: 3 }]).ok, true)
})

caso('RG-FEC-003: dois registros de capitão para a mesma equipe são recusados', () => {
  assert.equal(codigo(validarAssinaturasFechamento([apontador, capA, { ...capA, ordem: 5 }, capB, arbitro])), 'RG-FEC-003')
})

caso('RG-FEC-002: o fechamento da partida exige totais coerentes e assinaturas na ordem', () => {
  let log: readonly SumulaEvento[] = []
  const r = anexarEvento(log, { tipo: 'WO', payload: { ausente: 'B' }, clientEventId: 'wo-1' } as NovoEvento)
  if (!r.ok) throw new Error(r.mensagem)
  log = r.log
  const fechamento = calcularFechamento(log, CONFIG_FIVB_MELHOR_DE_5)
  assert.equal(validarFechamentoComAssinaturas(fechamento, [apontador, capA, capB, arbitro]).ok, true)
  const fora = validarFechamentoComAssinaturas(fechamento, [{ ...arbitro, ordem: 1 }, { ...apontador, ordem: 2 }, { ...capA, ordem: 3 }, { ...capB, ordem: 4 }])
  assert.equal(codigo(fora), 'RG-FEC-002')
  const naoTerminada = calcularFechamento([], CONFIG_FIVB_MELHOR_DE_5)
  assert.equal(codigo(validarFechamentoComAssinaturas(naoTerminada, [apontador, capA, capB, arbitro])), 'RG-FEC-004')
})

encerrar('regras-volei-assinaturas')
