import {
  aplicarRally,
  calcularReversaoFaltaRotacao,
  consequenciaFaltaDePosicao,
  decidirFaltaSimultanea,
  rodar,
  sacadorDaFormacao,
  validarFormacaoInicial,
  validarSacador,
  type EstadoSaque,
  type PontoLog,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const inicial: EstadoSaque = { formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saca: 'A' }

caso('RG-FOR-005: formação inicial exige 6 jogadores distintos', () => {
  assert.equal(validarFormacaoInicial([1, 2, 3, 4, 5, 6]).ok, true)
  const curta = validarFormacaoInicial([1, 2, 3, 4, 5])
  assert.equal(curta.ok, false)
  if (!curta.ok) assert.equal(curta.codigo, 'RG-FOR-005')
  assert.equal(validarFormacaoInicial([1, 1, 3, 4, 5, 6]).ok, false)
})

caso('RG-SAQ-002: rodízio horário (2->1, 1->6, 6->5, 5->4, 4->3, 3->2)', () => {
  // posição I..VI = índices 0..5
  assert.deepEqual(rodar([1, 2, 3, 4, 5, 6]), [2, 3, 4, 5, 6, 1])
  assert.equal(sacadorDaFormacao(rodar([1, 2, 3, 4, 5, 6])), 2) // quem estava na II vai sacar
  // seis rodízios devolvem a formação original
  let f: readonly number[] = [1, 2, 3, 4, 5, 6]
  for (let i = 0; i < 6; i += 1) f = rodar(f)
  assert.deepEqual(f, [1, 2, 3, 4, 5, 6])
})

caso('RG-SAQ-001: quem sacou e ganhou mantém o sacador, sem rodízio', () => {
  const r = aplicarRally(inicial, 'A')
  assert.equal(r.saca, 'A')
  assert.deepEqual(r.formacaoA, [1, 2, 3, 4, 5, 6])
})

caso('RG-SAQ-002: quem recebia e ganhou o rally saca e roda; o adversário não roda', () => {
  const r = aplicarRally(inicial, 'B')
  assert.equal(r.saca, 'B')
  assert.deepEqual(r.formacaoB, [12, 13, 14, 15, 16, 11])
  assert.deepEqual(r.formacaoA, [1, 2, 3, 4, 5, 6])
})

caso('RG-SAQ-004: saque por jogador fora da ordem é sinalizado', () => {
  assert.equal(validarSacador(inicial, 1).ok, true)
  const r = validarSacador(inicial, 3)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.codigo, 'RG-ROT-001')
    assert.match(r.mensagem, /deveria sacar com o jogador 1/)
  }
})

caso('RG-POS-003: falta de posição dá ponto e saque e NUNCA cancela pontos', () => {
  const c = consequenciaFaltaDePosicao('B')
  assert.equal(c.pontoParaAdversario, 1)
  assert.equal(c.saqueParaAdversario, true)
  assert.equal(c.cancelaPontosAnteriores, false)
})

caso('RG-POS-004: falta de saque prevalece sobre falta de posição simultânea', () => {
  assert.equal(
    decidirFaltaSimultanea({ faltaDoSacador: true, faltaDePosicaoAdversaria: true, saqueDepoisFalhou: false }),
    'FALTA_SAQUE',
  )
  assert.equal(
    decidirFaltaSimultanea({ faltaDoSacador: false, faltaDePosicaoAdversaria: true, saqueDepoisFalhou: true }),
    'FALTA_POSICAO',
  )
})

// CJ-03: B faz 11 pontos desde o saque errado; A tem pontos antes e depois.
const pontos: PontoLog[] = [
  { seq: 1, equipe: 'A' },
  { seq: 2, equipe: 'A' },
  { seq: 3, equipe: 'B' }, // antes da falta: permanece
  { seq: 4, equipe: 'B' }, // momento da falta (seq 4)
  { seq: 5, equipe: 'A' },
  { seq: 6, equipe: 'B' },
  { seq: 7, equipe: 'A' },
  { seq: 8, equipe: 'B' },
]

caso('RG-ROT-002 / CJ-03: cancela só os pontos da equipe faltosa desde o momento; os do adversário ficam', () => {
  const r = calcularReversaoFaltaRotacao(pontos, { equipeFaltosa: 'B', momentoSeq: 4 })
  assert.deepEqual(r.cancelados, [4, 6, 8])
  assert.equal(r.pontoParaAdversario >= 1, true)
  assert.equal(r.saqueParaAdversario, true)
  assert.equal(r.precisaSumulaAnexa, true)
  assert.ok(r.codigos.includes('RG-ROT-002'))
  // pontos de A (5 e 7) e o ponto de B anterior à falta (3) NÃO foram cancelados
  assert.ok(!r.cancelados.includes(5) && !r.cancelados.includes(7) && !r.cancelados.includes(3))
})

caso('RG-ROT-001: o ponto e o saque vão ao adversário e o rodízio é retificado', () => {
  const r = calcularReversaoFaltaRotacao(pontos, { equipeFaltosa: 'A', momentoSeq: 7 })
  assert.equal(r.saqueParaAdversario, true)
  assert.deepEqual(r.cancelados, [7])
  assert.ok(r.codigos.includes('RG-ROT-001'))
})

caso('RG-ROT-003: sem momento determinável só há ponto e saque, sem cancelamento', () => {
  const r = calcularReversaoFaltaRotacao(pontos, { equipeFaltosa: 'B', momentoSeq: null })
  assert.deepEqual(r.cancelados, [])
  assert.equal(r.precisaSumulaAnexa, false)
  assert.ok(r.codigos.includes('RG-ROT-003'))
  assert.match(r.mensagem, /sem momento determinável/)
})

caso('RG-ROT-004: rally da falta já concluído ganho pelo adversário rende um único ponto', () => {
  // B sacou fora da ordem (seq 5); A ganhou esse rally (seq 5). A recebe 1 ponto só: o ponto do rally é absorvido.
  const lista: PontoLog[] = [
    { seq: 1, equipe: 'A' },
    { seq: 5, equipe: 'A' },
  ]
  const r = calcularReversaoFaltaRotacao(lista, { equipeFaltosa: 'B', momentoSeq: 5, pontoDoRallyDaFaltaSeq: 5 })
  assert.deepEqual(r.cancelados, [5])
  assert.equal(r.pontoParaAdversario, 1)
  assert.ok(r.codigos.includes('RG-ROT-004'))
})

caso('RG-ROT-005: sem pontos cancelados não há súmula anexa', () => {
  const r = calcularReversaoFaltaRotacao([{ seq: 1, equipe: 'A' }], { equipeFaltosa: 'B', momentoSeq: 2 })
  assert.deepEqual(r.cancelados, [])
  assert.equal(r.precisaSumulaAnexa, false)
})

encerrar('regras-volei-rotacao')
