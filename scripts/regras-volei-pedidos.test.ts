import { randomUUID } from 'node:crypto'
import {
  anexarEvento,
  classificarPedidoIndevido,
  CONFIG_FIVB_MELHOR_DE_5,
  derivarPlacar,
  encerrarInterrupcao,
  interrupcaoVazia,
  registrarPedidoNaInterrupcao,
  validarPedidoNaInterrupcao,
  type ConfigPartida,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { validarNovoEvento } from '../src/lib/sumula-eventos'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5
const CTX: ContextoDerivacao = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], B: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
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

  iniciarSet(): void {
    this.add('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [21, 22, 23, 24, 25, 26], saqueInicial: 'A' })
  }

  ponto(equipe: Equipe): void {
    this.add('PONTO', { equipe })
  }

  indevido(equipe: Equipe, atrasaOJogo?: boolean): void {
    this.add('PEDIDO_INDEVIDO', { equipe, tipo: 'TEMPO', ...(atrasaOJogo === undefined ? {} : { atrasaOJogo }) })
  }

  estado(config: ConfigPartida = c5, ctx: ContextoDerivacao | undefined = undefined) {
    return derivarPlacar(this.log, config, ctx)
  }
}

const codigos = (j: Jogo, ctx?: ContextoDerivacao) => j.estado(c5, ctx).inconsistencias.map((i) => i.codigo)

/* ------------------------------ RG-TMP-003 ------------------------------ */

caso('RG-TMP-003: dois tempos e um pedido de substituição cabem na mesma interrupção, em qualquer ordem', () => {
  let estado = interrupcaoVazia()
  for (const tipo of ['TEMPO', 'SUBSTITUICAO', 'TEMPO'] as const) {
    assert.equal(validarPedidoNaInterrupcao(estado, { tipo }).ok, true)
    estado = registrarPedidoNaInterrupcao(estado, tipo)
  }
  assert.deepEqual(estado, { tempos: 2, substituicoes: 1, bloqueada: false })
})

caso('RG-TMP-003: o terceiro tempo e o segundo pedido de substituição seguidos são indevidos', () => {
  const doisTempos = registrarPedidoNaInterrupcao(registrarPedidoNaInterrupcao(interrupcaoVazia(), 'TEMPO'), 'TEMPO')
  const terceiro = validarPedidoNaInterrupcao(doisTempos, { tipo: 'TEMPO' })
  assert.equal(terceiro.ok, false)
  if (!terceiro.ok) assert.equal(terceiro.codigo, 'RG-TMP-003')
  const umaSub = registrarPedidoNaInterrupcao(interrupcaoVazia(), 'SUBSTITUICAO')
  const segunda = validarPedidoNaInterrupcao(umaSub, { tipo: 'SUBSTITUICAO' })
  assert.equal(segunda.ok, false)
  if (!segunda.ok) assert.equal(segunda.codigo, 'RG-TMP-003')
  // Um rally concluído encerra a interrupção.
  assert.equal(validarPedidoNaInterrupcao(encerrarInterrupcao(), { tipo: 'SUBSTITUICAO' }).ok, true)
})

caso('RG-TMP-003: na derivação, tempo-tempo-substituição na mesma interrupção é válido e o ponto zera a sequência', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('TEMPO', { equipe: 'A' })
  j.add('TEMPO', { equipe: 'A' })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  assert.deepEqual(codigos(j), [])
  assert.deepEqual(j.estado().pedidosNaInterrupcao.A, { tempos: 2, substituicoes: 1, bloqueada: false })
  j.ponto('A')
  assert.deepEqual(j.estado().pedidosNaInterrupcao.A, { tempos: 0, substituicoes: 0, bloqueada: false })
})

caso('RG-TMP-003: dois pedidos de substituição seguidos viram inconsistência (sem contexto da relação nominal)', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8 })
  assert.deepEqual(codigos(j), ['RG-TMP-003'])
})

caso('RG-TMP-003: o terceiro tempo seguido é inconsistência mesmo num perfil com mais de 2 tempos por set', () => {
  const j = new Jogo()
  j.iniciarSet()
  for (let i = 0; i < 3; i += 1) j.add('TEMPO', { equipe: 'B' })
  const config: ConfigPartida = { ...c5, perfil: { ...c5.perfil, temposPorSet: 3 } }
  assert.deepEqual(j.estado(config).inconsistencias.map((i) => i.codigo), ['RG-TMP-003'])
})

/* ------------------------------ RG-TMP-005 ------------------------------ */

caso('RG-TMP-005: o primeiro pedido indevido da equipe, sem atrasar o jogo, é só registrado', () => {
  const c = classificarPedidoIndevido({ indevidosAnterioresSemAtraso: 0, atrasosAnteriores: 0 })
  assert.equal(c.consequencia, 'REGISTRO_SEM_SANCAO')
  assert.equal(c.sancaoSugerida, null)
  assert.equal(c.bloqueiaNovosPedidos, false)
})

caso('RG-TMP-005: o segundo pedido indevido é atraso (advertência na primeira vez, penalidade depois)', () => {
  const primeiroAtraso = classificarPedidoIndevido({ indevidosAnterioresSemAtraso: 1, atrasosAnteriores: 0 })
  assert.equal(primeiroAtraso.consequencia, 'ATRASO')
  assert.equal(primeiroAtraso.sancaoSugerida, 'ADVERTENCIA_ATRASO')
  const jaAdvertida = classificarPedidoIndevido({ indevidosAnterioresSemAtraso: 1, atrasosAnteriores: 1 })
  assert.equal(jaAdvertida.sancaoSugerida, 'PENALIDADE_ATRASO')
  assert.equal(jaAdvertida.bloqueiaNovosPedidos, false)
})

caso('RG-TMP-005: pedido indevido que atrasa o jogo vai direto a atraso, mesmo sendo o primeiro', () => {
  const c = classificarPedidoIndevido({ indevidosAnterioresSemAtraso: 0, atrasosAnteriores: 0, atrasaOJogo: true })
  assert.equal(c.consequencia, 'ATRASO')
})

caso('RG-TMP-005: a derivação classifica os pedidos indevidos por equipe e partida', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.indevido('A')
  j.ponto('A')
  j.indevido('B') // primeiro da equipe B: também é só registrado
  j.indevido('A')
  const p = j.estado()
  assert.deepEqual(p.pedidosIndevidos.map((x) => [x.equipe, x.consequencia]), [
    ['A', 'REGISTRO_SEM_SANCAO'],
    ['B', 'REGISTRO_SEM_SANCAO'],
    ['A', 'ATRASO'],
  ])
  assert.equal(p.pedidosIndevidos[2]!.sancaoSugerida, 'ADVERTENCIA_ATRASO')
  assert.deepEqual(p.inconsistencias, [])
})

caso('RG-TMP-005: o servidor avisa a consequência ao receber o pedido indevido', () => {
  const j = new Jogo()
  j.iniciarSet()
  const r1 = validarNovoEvento(j.log, c5, CTX, { clientEventId: randomUUID(), tipo: 'PEDIDO_INDEVIDO', payload: { equipe: 'A', tipo: 'TEMPO' } })
  assert.equal(r1.ok, true)
  if (r1.ok && !r1.duplicado) assert.equal(r1.avisos[0]?.codigo, 'RG-TMP-005')
  j.indevido('A')
  const r2 = validarNovoEvento(j.log, c5, CTX, { clientEventId: randomUUID(), tipo: 'PEDIDO_INDEVIDO', payload: { equipe: 'A' } })
  assert.equal(r2.ok, true)
  if (r2.ok && !r2.duplicado) assert.match(r2.avisos[0]!.mensagem, /advertência/)
  const fora = validarNovoEvento([], c5, CTX, { clientEventId: randomUUID(), tipo: 'PEDIDO_INDEVIDO', payload: { equipe: 'A' } })
  assert.equal(fora.ok, false)
})

/* ------------------------------ RG-TMP-006 ------------------------------ */

caso('RG-TMP-006: advertência de atraso por pedido indevido bloqueia novo pedido regular até o fim do próximo rally', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.indevido('A') // registrado, sem consequência
  j.indevido('A') // atraso: advertência (primeira sanção de atraso da equipe)
  assert.equal(j.estado().pedidosNaInterrupcao.A.bloqueada, true)
  j.add('TEMPO', { equipe: 'A' })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  assert.deepEqual(codigos(j), ['RG-TMP-006', 'RG-TMP-006'])
  // O adversário não é afetado.
  const outra = new Jogo()
  outra.iniciarSet()
  outra.indevido('A')
  outra.indevido('A')
  outra.add('TEMPO', { equipe: 'B' })
  assert.deepEqual(codigos(outra), [])
})

caso('RG-TMP-006: o bloqueio cai no fim do próximo rally concluído', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.indevido('A')
  j.indevido('A')
  j.ponto('B')
  assert.equal(j.estado().pedidosNaInterrupcao.A.bloqueada, false)
  j.add('TEMPO', { equipe: 'A' })
  assert.deepEqual(codigos(j), [])
})

caso('RG-TMP-006: quem já foi advertida por atraso leva penalidade, e o pedido seguinte não fica bloqueado pela regra', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SANCAO', { equipe: 'A', membro: 'TECNICO', categoria: 'ATRASO', sancao: 'ADVERTENCIA_ATRASO', pontoParaAdversario: false })
  j.indevido('A')
  j.indevido('A')
  const p = j.estado()
  assert.equal(p.pedidosIndevidos[1]!.sancaoSugerida, 'PENALIDADE_ATRASO')
  assert.equal(p.pedidosNaInterrupcao.A.bloqueada, false)
})

caso('RG-TMP-006: a substituição excepcional não é bloqueada (não é interrupção regular)', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.indevido('A')
  j.indevido('A')
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7, excepcional: true, motivo: 'LESAO' })
  assert.deepEqual(codigos(j), [])
})

encerrar('regras-volei-pedidos')
