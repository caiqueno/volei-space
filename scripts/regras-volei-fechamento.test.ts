import {
  anexarEvento,
  avaliarSancao,
  calcularFechamento,
  configMelhorDe3,
  formatarDuracao,
  validarFechamento,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

// Sets de 3 pontos só para encurtar o roteiro.
const cfg = configMelhorDe3({ alvoSet: 3, alvoSetDecisivo: 3 })
const CTX = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], B: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
}

class Jogo {
  log: readonly SumulaEvento[] = []
  private n = 0

  add<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K], criadoEm?: string): number {
    this.n += 1
    const r = anexarEvento(this.log, { tipo, payload, clientEventId: `e-${this.n}`, ...(criadoEm ? { criadoEm } : {}) } as NovoEvento)
    if (!r.ok) throw new Error(`${r.codigo}: ${r.mensagem}`)
    this.log = r.log
    return r.evento.seq
  }

  iniciarSet(numeroSet: number, saqueInicial: Equipe, criadoEm?: string): number {
    return this.add(
      'SET_INICIADO',
      { numeroSet, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial },
      criadoEm,
    )
  }
}

const hora = (hhmm: string) => `2026-10-16T${hhmm}:00.000Z`

function sancaoMenor(equipe: Equipe, membro: string, set: number, entreSets = false) {
  const a = avaliarSancao([], { equipe, membro, categoria: 'MENOR', set, entreSets })
  if (!a.ok) throw new Error(a.mensagem)
  return { equipe, membro, categoria: 'MENOR', sancao: a.sancao, pontoParaAdversario: a.pontoParaAdversario, ...(entreSets ? { entreSets: true } : {}) }
}

/** A vence por 2x0: set 1 19:00-19:20 e set 2 19:25-19:40. */
function jogoCompleto(): Jogo {
  const j = new Jogo()
  j.iniciarSet(1, 'A', hora('19:00'))
  j.add('TEMPO', { equipe: 'A' }, hora('19:03'))
  j.add('SUBSTITUICAO', { equipe: 'A', trocas: [{ sai: 1, entra: 7 }, { sai: 2, entra: 8 }] }, hora('19:05'))
  j.add('SANCAO', sancaoMenor('B', 'J:12', 1), hora('19:08'))
  j.add('PONTO', { equipe: 'A' }, hora('19:10'))
  j.add('PONTO', { equipe: 'A' }, hora('19:15'))
  j.add('PONTO', { equipe: 'A' }, hora('19:20'))
  j.add('SANCAO', sancaoMenor('B', 'TECNICO', 1, true), hora('19:22'))
  j.iniciarSet(2, 'B', hora('19:25'))
  j.add('TEMPO', { equipe: 'B' }, hora('19:27'))
  j.add('TEMPO', { equipe: 'B' }, hora('19:30'))
  j.add('PONTO', { equipe: 'A' }, hora('19:35'))
  j.add('PONTO', { equipe: 'A' }, hora('19:38'))
  j.add('PONTO', { equipe: 'A' }, hora('19:40'))
  return j
}

caso('RG-SET-008: formatarDuracao usa 1 dígito de hora (2h00, 0h45, 1h05)', () => {
  assert.equal(formatarDuracao(120), '2h00')
  assert.equal(formatarDuracao(45), '0h45')
  assert.equal(formatarDuracao(65), '1h05')
})

caso('RG-SET-007: o fechamento de cada set traz tempos, substituições, sanções, horários e duração', () => {
  const f = calcularFechamento(jogoCompleto().log, cfg, CTX)
  const s1 = f.porSet[0]!
  assert.deepEqual(s1.placar, { a: 3, b: 0 })
  assert.equal(s1.vencedor, 'A')
  assert.deepEqual(s1.tempos, { A: 1, B: 0 })
  assert.deepEqual(s1.substituicoes, { A: 2, B: 0 }, 'uma por jogador do pedido em lote')
  assert.deepEqual(s1.sancoes, { A: 0, B: 1 })
  assert.equal(s1.inicioEm, hora('19:00'))
  assert.equal(s1.fimEm, hora('19:20'))
  assert.equal(s1.duracaoMinutos, 20)
})

caso('RG-SET-007: a sanção entre sets conta no set seguinte', () => {
  const f = calcularFechamento(jogoCompleto().log, cfg, CTX)
  const s2 = f.porSet[1]!
  assert.deepEqual(s2.sancoes, { A: 0, B: 1 })
  assert.deepEqual(s2.tempos, { A: 0, B: 2 })
  assert.equal(s2.duracaoMinutos, 15)
})

caso('RG-SET-008: os totais da partida somam tempos, substituições, sanções, sets e pontos', () => {
  const f = calcularFechamento(jogoCompleto().log, cfg, CTX)
  assert.deepEqual(f.totais.tempos, { A: 1, B: 2 })
  assert.deepEqual(f.totais.substituicoes, { A: 2, B: 0 })
  assert.deepEqual(f.totais.sancoes, { A: 0, B: 2 })
  assert.deepEqual(f.totais.pontos, { A: 6, B: 0 })
  assert.deepEqual(f.resultadoEmSets, { a: 2, b: 0 })
  assert.equal(f.vencedor, 'A')
  assert.equal(f.terminada, true)
})

caso('RG-SET-008: início, fim e duração total (com intervalos) e soma dos sets (sem intervalos)', () => {
  const f = calcularFechamento(jogoCompleto().log, cfg, CTX)
  assert.equal(f.inicioEm, hora('19:00'))
  assert.equal(f.fimEm, hora('19:40'))
  assert.equal(f.duracaoTotalMinutos, 40)
  assert.equal(f.duracaoTotalFormatada, '0h40')
  assert.equal(f.duracaoSetsMinutos, 35)
})

caso('RG-SET-008: sem criadoEm nos eventos os horários e durações ficam null, mas os totais continuam', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  for (let i = 0; i < 3; i += 1) j.add('PONTO', { equipe: 'A' })
  j.iniciarSet(2, 'B')
  for (let i = 0; i < 3; i += 1) j.add('PONTO', { equipe: 'A' })
  const f = calcularFechamento(j.log, cfg, CTX)
  assert.equal(f.inicioEm, null)
  assert.equal(f.fimEm, null)
  assert.equal(f.duracaoTotalMinutos, null)
  assert.equal(f.duracaoTotalFormatada, null)
  assert.deepEqual(f.totais.pontos, { A: 6, B: 0 })
})

caso('RG-FEC-004: o fechamento é válido com a partida terminada e totais coerentes', () => {
  assert.equal(validarFechamento(calcularFechamento(jogoCompleto().log, cfg, CTX)).ok, true)
})

caso('RG-FEC-004: partida em andamento não fecha', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  j.add('PONTO', { equipe: 'A' })
  const r = validarFechamento(calcularFechamento(j.log, cfg, CTX))
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-FEC-004')
})

caso('RG-FEC-004: log com inconsistência não fecha os totais', () => {
  const j = jogoCompleto()
  j.add('PONTO', { equipe: 'B' }) // ponto depois do fim da partida
  const r = validarFechamento(calcularFechamento(j.log, cfg, CTX))
  assert.equal(r.ok, false)
})

caso('RG-FEC-004: no WO o resultado em sets é o da partida (presente vence) e o horário do WO fecha o jogo', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'A', hora('19:00'))
  j.add('WO', { ausente: 'B' }, hora('19:30'))
  const f = calcularFechamento(j.log, cfg, CTX)
  assert.equal(f.status, 'WO')
  assert.equal(f.vencedor, 'A')
  assert.equal(f.resultadoEmSets.b, 0)
  assert.equal(f.fimEm, hora('19:30'))
  assert.equal(validarFechamento(f).ok, true)
})

encerrar('regras-volei-fechamento')
