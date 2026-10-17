import {
  anexarEvento,
  calcularPerdaPorNaoRegistrado,
  CONFIG_FIVB_MELHOR_DE_5,
  derivarPlacar,
  type ConfigPartida,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SetAnteriorParaPerda,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

/*
 * RG-FOR-009 completo. O texto do artigo (7.3.5.4) diz "perde todos os pontos e/ou sets (0x25 se necessário) desde
 * que o não registrado entrou". Os testes cobrem só isso. O parcial exato do set de ENTRADA e o tratamento dos sets
 * que a faltosa já tinha perdido são interpretação (configurável): não são afirmados como oficiais.
 */

const c5 = CONFIG_FIVB_MELHOR_DE_5
const CTX: ContextoDerivacao = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], B: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
  capitao: { A: 1, B: 21 },
}

class Jogo {
  log: readonly SumulaEvento[] = []
  private n = 0

  add<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K]): number {
    this.n += 1
    const r = anexarEvento(this.log, { tipo, payload, clientEventId: `e-${this.n}` } as NovoEvento)
    if (!r.ok) throw new Error(`${r.codigo}: ${r.mensagem}`)
    this.log = r.log
    return r.evento.seq
  }

  iniciarSet(numeroSet: number, saqueInicial: Equipe = 'A'): void {
    this.add('SET_INICIADO', {
      numeroSet,
      formacaoA: [1, 2, 3, 4, 5, 6],
      formacaoB: [21, 22, 23, 24, 25, 26],
      saqueInicial,
    })
  }

  pontos(equipe: Equipe, quantos: number): number[] {
    return Array.from({ length: quantos }, () => this.add('PONTO', { equipe }))
  }

  estado(config: ConfigPartida = c5) {
    return derivarPlacar(this.log, config, CTX)
  }
}

/** 1º set vencido por A (25x20); 2º vencido por B (25x10); 3º em andamento (A 5 x B 3). Devolve o seq do 11º ponto de A no 1º set. */
function montarJogo(): { j: Jogo; seqEntrada: number } {
  const j = new Jogo()
  j.iniciarSet(1, 'A')
  const primeiros = j.pontos('A', 10)
  j.pontos('B', 20)
  const ultimos = j.pontos('A', 15)
  assert.equal(primeiros.length + ultimos.length, 25)
  j.iniciarSet(2, 'B')
  j.pontos('A', 10)
  j.pontos('B', 25)
  j.iniciarSet(3, 'A')
  j.pontos('A', 5)
  j.pontos('B', 3)
  return { j, seqEntrada: ultimos[0]! }
}

/* ------------------------------ função pura ------------------------------ */

function setFeito(numero: number, vencedor: Equipe, a: number, b: number, primeiroSeq: number, alvo = 25): SetAnteriorParaPerda {
  const pontos = [
    ...Array.from({ length: a }, (_, i) => ({ seq: primeiroSeq + i, equipe: 'A' as Equipe, cancelado: false })),
    ...Array.from({ length: b }, (_, i) => ({ seq: primeiroSeq + a + i, equipe: 'B' as Equipe, cancelado: false })),
  ]
  return { numero, alvo, encerrado: true, vencedor, placar: { a, b }, pontos }
}

caso('RG-FOR-009: set posterior à entrada que a faltosa venceu vira derrota com parcial 0x25', () => {
  const r = calcularPerdaPorNaoRegistrado({
    faltosa: 'A',
    setEntrada: 1,
    momentoSeq: 5,
    setsAnteriores: [setFeito(1, 'B', 10, 25, 1), setFeito(2, 'A', 25, 22, 100)],
    opcoes: { margem: 2 },
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  const set2 = r.perdas.find((p) => p.numero === 2)!
  assert.deepEqual(set2.placar, { a: 0, b: 25 })
  assert.equal(set2.vencedor, 'B')
  assert.equal(set2.faltosaPerdeuOSet, true)
  assert.equal(set2.cancelados.length, 25)
  assert.deepEqual(r.setsPerdidosPelaFaltosa, [2])
})

caso('RG-FOR-009: no set de entrada a faltosa perde os pontos desde o momento e, se tinha vencido, o set', () => {
  const r = calcularPerdaPorNaoRegistrado({
    faltosa: 'A',
    setEntrada: 1,
    momentoSeq: 11,
    setsAnteriores: [setFeito(1, 'A', 25, 20, 1)],
    opcoes: { margem: 2 },
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  const entrada = r.perdas[0]!
  assert.equal(entrada.papel, 'ENTRADA')
  assert.equal(entrada.cancelados.length, 15) // pontos 11 a 25 de A
  assert.equal(entrada.placar.a, 10)
  assert.equal(entrada.vencedor, 'B')
  assert.ok(entrada.placar.b >= 25)
  assert.equal(entrada.sobrescreve, true)
})

caso('RG-FOR-009: set de entrada que a faltosa já tinha perdido só perde os pontos, sem trocar o vencedor', () => {
  const r = calcularPerdaPorNaoRegistrado({
    faltosa: 'A',
    setEntrada: 1,
    momentoSeq: 6,
    setsAnteriores: [setFeito(1, 'B', 15, 25, 1)],
    opcoes: { margem: 2 },
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.perdas[0]!.vencedor, 'B')
  assert.equal(r.perdas[0]!.sobrescreve, false)
  assert.equal(r.perdas[0]!.placar.a, 5)
  assert.equal(r.perdas[0]!.placar.b, 25)
  assert.deepEqual(r.setsPerdidosPelaFaltosa, [])
})

caso('RG-FOR-009: sets anteriores à entrada não são tocados', () => {
  const r = calcularPerdaPorNaoRegistrado({
    faltosa: 'A',
    setEntrada: 2,
    momentoSeq: 150,
    setsAnteriores: [setFeito(1, 'A', 25, 20, 1), setFeito(2, 'B', 5, 25, 100)],
    opcoes: { margem: 2 },
  })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.perdas.map((p) => p.numero), [2])
})

caso('RG-FOR-009: sem o momento da entrada, ou com set de entrada inexistente, o cálculo é recusado', () => {
  const sets = [setFeito(1, 'A', 25, 20, 1)]
  const semMomento = calcularPerdaPorNaoRegistrado({ faltosa: 'A', setEntrada: 1, momentoSeq: null, setsAnteriores: sets, opcoes: { margem: 2 } })
  assert.equal(semMomento.ok, false)
  if (!semMomento.ok) assert.equal(semMomento.codigo, 'RG-FOR-009')
  const inexistente = calcularPerdaPorNaoRegistrado({ faltosa: 'A', setEntrada: 3, momentoSeq: 5, setsAnteriores: sets, opcoes: { margem: 2 } })
  assert.equal(inexistente.ok, false)
})

caso('RG-FOR-009: sets que a faltosa já tinha perdido mantêm o parcial real, salvo a opção do regulamento (configurável)', () => {
  const base = {
    faltosa: 'A' as Equipe,
    setEntrada: 1,
    momentoSeq: 1,
    setsAnteriores: [setFeito(1, 'B', 5, 25, 1), setFeito(2, 'B', 12, 25, 100)],
  }
  const padrao = calcularPerdaPorNaoRegistrado({ ...base, opcoes: { margem: 2 } })
  const zerando = calcularPerdaPorNaoRegistrado({ ...base, opcoes: { margem: 2, zerarSetsJaPerdidos: true } })
  assert.equal(padrao.ok && zerando.ok, true)
  if (!padrao.ok || !zerando.ok) return
  // O padrão e a opção são ambos suportados; o teste só garante que a opção é lida, sem eleger uma como oficial.
  assert.notDeepEqual(padrao.perdas[1]!.placar, zerando.perdas[1]!.placar)
  assert.deepEqual(zerando.perdas[1]!.placar, { a: 0, b: 25 })
})

/* ------------------------------ derivação do log ------------------------------ */

caso('RG-FOR-009: jogador não registrado que entrou no 1º set refaz o 1º set e zera os pontos da faltosa no set corrente', () => {
  const { j, seqEntrada } = montarJogo()
  j.add('DISCREPANCIA_PAPELETA', {
    equipe: 'A',
    fase: 'DEPOIS_DO_INICIO',
    causa: 'JOGADOR_NAO_REGISTRADO',
    jogador: 99,
    setEntrada: 1,
    momentoSeq: seqEntrada,
  })
  const p = j.estado()
  assert.deepEqual(p.inconsistencias, [])
  const [set1, set2, set3] = p.sets
  assert.equal(set1!.vencedor, 'B', 'A perde o 1º set que tinha vencido')
  assert.equal(set1!.placar.a, 10)
  assert.ok(set1!.placar.b >= 25)
  assert.equal(set2!.vencedor, 'B')
  assert.deepEqual(set2!.placar, { a: 10, b: 25 }, 'set já perdido pela faltosa mantém o parcial real (padrão)')
  assert.equal(set3!.placar.a, 0, 'no set corrente a faltosa perde todos os pontos')
  assert.equal(set3!.placar.b, 4, 'o adversário mantém os 3 e ganha 1 ponto')
  assert.equal(p.saca, 'B')
  assert.deepEqual(p.setsGanhos, { a: 0, b: 2 })
  assert.equal(p.houveCancelamentoDePontos, true)
  assert.equal(p.discrepanciasPapeleta[0]?.codigo, 'RG-FOR-009')
  assert.ok(p.observacoes.some((o) => o.texto.includes('NÃO REGISTRADO')))
})

caso('RG-FOR-009: entrada no 2º set não mexe no 1º set', () => {
  const { j } = montarJogo()
  const seqSet2 = j.estado().sets[1]!.pontos[0]!.seq
  j.add('DISCREPANCIA_PAPELETA', {
    equipe: 'A',
    fase: 'DEPOIS_DO_INICIO',
    causa: 'JOGADOR_NAO_REGISTRADO',
    jogador: 99,
    setEntrada: 2,
    momentoSeq: seqSet2,
  })
  const p = j.estado()
  assert.deepEqual(p.inconsistencias, [])
  assert.equal(p.sets[0]!.vencedor, 'A')
  assert.deepEqual(p.sets[0]!.placar, { a: 25, b: 20 })
  assert.equal(p.sets[2]!.placar.a, 0)
  assert.deepEqual(p.setsGanhos, { a: 1, b: 1 })
})

caso('RG-FOR-009: a opção do regulamento zera também o set que a faltosa já tinha perdido (0x25)', () => {
  const { j, seqEntrada } = montarJogo()
  j.add('DISCREPANCIA_PAPELETA', {
    equipe: 'A',
    fase: 'DEPOIS_DO_INICIO',
    causa: 'JOGADOR_NAO_REGISTRADO',
    jogador: 99,
    setEntrada: 1,
    momentoSeq: seqEntrada,
  })
  const p = j.estado({ ...c5, naoRegistradoZeraSetsJaPerdidos: true })
  assert.deepEqual(p.sets[1]!.placar, { a: 0, b: 25 })
})

caso('RG-FOR-009: set de entrada sem momento, posterior ao corrente ou com causa diferente vira inconsistência', () => {
  const base = { equipe: 'A', fase: 'DEPOIS_DO_INICIO', jogador: 99 } as const
  const semMomento = montarJogo().j
  semMomento.add('DISCREPANCIA_PAPELETA', { ...base, causa: 'JOGADOR_NAO_REGISTRADO', setEntrada: 1 })
  assert.equal(semMomento.estado().inconsistencias[0]?.codigo, 'RG-FOR-009')
  assert.equal(semMomento.estado().sets[0]!.vencedor, 'A', 'nada é alterado quando o pedido é recusado')

  const futuro = montarJogo().j
  futuro.add('DISCREPANCIA_PAPELETA', { ...base, causa: 'JOGADOR_NAO_REGISTRADO', setEntrada: 4, momentoSeq: 1 })
  assert.equal(futuro.estado().inconsistencias[0]?.codigo, 'RG-FOR-009')

  const outraCausa = montarJogo().j
  outraCausa.add('DISCREPANCIA_PAPELETA', { ...base, causa: 'POSICAO', setEntrada: 1, momentoSeq: 1 })
  assert.equal(outraCausa.estado().inconsistencias[0]?.codigo, 'RG-FOR-009')
})

caso('RG-FOR-009: sem setEntrada o comportamento é o do set corrente (não mexe nos sets anteriores)', () => {
  const { j } = montarJogo()
  const primeiroPontoSet3 = j.estado().sets[2]!.pontos[0]!.seq
  j.add('DISCREPANCIA_PAPELETA', {
    equipe: 'A',
    fase: 'DEPOIS_DO_INICIO',
    causa: 'JOGADOR_NAO_REGISTRADO',
    jogador: 99,
    momentoSeq: primeiroPontoSet3,
  })
  const p = j.estado()
  assert.equal(p.sets[0]!.vencedor, 'A')
  assert.deepEqual(p.setsGanhos, { a: 1, b: 1 })
})

encerrar('regras-volei-nao-registrado')
