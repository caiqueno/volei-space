import {
  anexarEvento,
  CONFIG_FIVB_MELHOR_DE_5,
  configMelhorDe3,
  derivarPlacar,
  derivarPlacarAte,
  eventosEfetivos,
  validarLog,
  type ConfigPartida,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

class Jogo {
  log: readonly SumulaEvento[] = []
  private n = 0

  add<K extends SumulaEventoTipo>(tipo: K, payload: PayloadPorTipo[K], desfazId: number | null = null): number {
    this.n += 1
    const r = anexarEvento(this.log, { tipo, payload, clientEventId: `e-${this.n}`, desfazId } as NovoEvento)
    if (!r.ok) throw new Error(`${r.codigo}: ${r.mensagem}`)
    this.log = r.log
    return r.evento.seq
  }

  iniciarSet(numeroSet: number, saqueInicial: Equipe = 'A'): number {
    return this.add('SET_INICIADO', {
      numeroSet,
      formacaoA: [1, 2, 3, 4, 5, 6],
      formacaoB: [11, 12, 13, 14, 15, 16],
      saqueInicial,
    })
  }

  pontos(equipe: Equipe, quantos: number): void {
    for (let i = 0; i < quantos; i += 1) this.add('PONTO', { equipe })
  }
}

const c5 = CONFIG_FIVB_MELHOR_DE_5

caso('RG-SAQ-002: placar, saque e rotação são derivados só dos eventos', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'A' }) // A saca e ganha: sem rodízio
  j.add('PONTO', { equipe: 'B' }) // B recebia e ganha: B saca e roda
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.setAtual?.placar, { a: 1, b: 1 })
  assert.equal(p.saca, 'B')
  assert.deepEqual(p.formacaoA, [1, 2, 3, 4, 5, 6])
  assert.deepEqual(p.formacaoB, [12, 13, 14, 15, 16, 11])
  assert.equal(p.status, 'EM_ANDAMENTO')
})

caso('RG-SET-001: o set fecha sozinho em 25x23 e ponto extra é inconsistência ignorada', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 23)
  j.pontos('B', 23)
  j.pontos('A', 2)
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.sets[0]?.placar, { a: 25, b: 23 })
  assert.equal(p.sets[0]?.encerrado, true)
  assert.deepEqual(p.setsGanhos, { a: 1, b: 0 })
  j.add('PONTO', { equipe: 'B' })
  const depois = derivarPlacar(j.log, c5)
  assert.deepEqual(depois.sets[0]?.placar, { a: 25, b: 23 })
  assert.equal(depois.inconsistencias.length, 1)
})

caso('RG-SET-002: 25x24 não fecha o set; 26x24 fecha', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 24)
  j.pontos('B', 24)
  j.pontos('A', 1)
  assert.equal(derivarPlacar(j.log, c5).sets[0]?.encerrado, false)
  j.pontos('A', 1)
  assert.equal(derivarPlacar(j.log, c5).sets[0]?.encerrado, true)
})

caso('RG-SET-004: partida encerra em 3 sets e não aceita novo set', () => {
  const j = new Jogo()
  for (let s = 1; s <= 3; s += 1) {
    j.iniciarSet(s)
    j.pontos('A', 25)
  }
  const p = derivarPlacar(j.log, c5)
  assert.equal(p.status, 'ENCERRADA')
  assert.equal(p.vencedor, 'A')
  assert.deepEqual(p.setsGanhos, { a: 3, b: 0 })
  j.iniciarSet(4)
  assert.equal(derivarPlacar(j.log, c5).inconsistencias[0]?.codigo, 'RG-SET-004')
})

caso('RG-SET-003: 2x2 leva ao set decisivo aos 15, com troca de lado aos 8 pendente até o evento', () => {
  const j = new Jogo()
  const vencedores: Equipe[] = ['A', 'B', 'A', 'B']
  vencedores.forEach((v, i) => {
    j.iniciarSet(i + 1)
    j.pontos(v, 25)
  })
  j.iniciarSet(5)
  j.pontos('A', 7)
  let p = derivarPlacar(j.log, c5)
  assert.equal(p.setAtual?.decisivo, true)
  assert.equal(p.setAtual?.alvo, 15)
  assert.equal(p.setAtual?.trocaLadoPendente, false)
  j.pontos('A', 1) // líder chega a 8
  p = derivarPlacar(j.log, c5)
  assert.equal(p.setAtual?.trocaLadoPendente, true) // RG-SET-006
  j.add('TROCA_LADO', {})
  assert.equal(derivarPlacar(j.log, c5).setAtual?.trocaLadoPendente, false)
  j.pontos('A', 7)
  p = derivarPlacar(j.log, c5)
  assert.equal(p.status, 'ENCERRADA')
  assert.deepEqual(p.sets[4]?.placar, { a: 15, b: 0 })
})

caso('RG-SET-004: melhor de 3 com 3º set obrigatório só encerra depois do 3º', () => {
  const c3 = configMelhorDe3({ terceiroSetObrigatorio: true })
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 25)
  j.iniciarSet(2)
  j.pontos('A', 25)
  assert.equal(derivarPlacar(j.log, c3).status, 'EM_ANDAMENTO')
  j.iniciarSet(3)
  j.pontos('B', 15)
  const p = derivarPlacar(j.log, c3)
  assert.equal(p.status, 'ENCERRADA')
  assert.deepEqual(p.setsGanhos, { a: 2, b: 1 })
})

/* ------------------------- reconstrução (event sourcing) ------------------------- */

function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Simula uma partida com contagem independente (sem usar o motor) e devolve a verdade esperada. */
function simular(seed: number, config: ConfigPartida): { j: Jogo; sets: Array<{ a: number; b: number }> } {
  const rnd = lcg(seed)
  const j = new Jogo()
  const sets: Array<{ a: number; b: number }> = []
  let ganhosA = 0
  let ganhosB = 0
  const necessarios = Math.floor(config.melhorDe / 2) + 1
  let numero = 1
  while (ganhosA < necessarios && ganhosB < necessarios) {
    const alvo = numero >= config.melhorDe ? config.alvoSetDecisivo : config.alvoSet
    j.iniciarSet(numero)
    let a = 0
    let b = 0
    const favorito = rnd() < 0.5 ? 'A' : 'B'
    while (!(Math.max(a, b) >= alvo && Math.abs(a - b) >= 2)) {
      const equipe: Equipe = rnd() < (favorito === 'A' ? 0.55 : 0.45) ? 'A' : 'B'
      j.add('PONTO', { equipe })
      if (equipe === 'A') a += 1
      else b += 1
    }
    sets.push({ a, b })
    if (a > b) ganhosA += 1
    else ganhosB += 1
    numero += 1
  }
  return { j, sets }
}

caso('RG-SET-001..004 / J02: placar reconstruído só dos eventos coincide com a contagem independente (200 partidas)', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const config = seed % 2 === 0 ? c5 : configMelhorDe3()
    const { j, sets } = simular(seed, config)
    const p = derivarPlacar(j.log, config)
    assert.deepEqual(p.sets.map((s) => s.placar), sets, `seed ${seed}`)
    assert.equal(p.status, 'ENCERRADA', `seed ${seed}`)
    assert.equal(p.inconsistencias.length, 0, `seed ${seed}`)
  }
})

caso('RG-LOG-006: reconstrução é determinística e independe de onde o log foi cortado (prefixos)', () => {
  const { j } = simular(7, c5)
  const completo = derivarPlacar(j.log, c5)
  assert.deepEqual(derivarPlacar([...j.log], c5), completo)
  // viagem no tempo: o placar no meio do log é o do prefixo
  const meio = j.log[Math.floor(j.log.length / 2)]!.seq
  const noMeio = derivarPlacarAte(j.log, c5, meio)
  assert.deepEqual(noMeio, derivarPlacar(j.log.slice(0, meio), c5))
  assert.equal(noMeio.ultimoSeq, meio)
})

caso('RG-LOG-005: o log é imutável (append-only): anexar não altera o log anterior e congela os eventos', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  const antes = j.log
  const tamanho = antes.length
  const r = anexarEvento(antes, { tipo: 'PONTO', payload: { equipe: 'A' }, clientEventId: 'x1' })
  assert.equal(r.ok, true)
  assert.equal(antes.length, tamanho)
  if (r.ok) {
    assert.equal(r.log.length, tamanho + 1)
    assert.equal(Object.isFrozen(r.evento), true)
    assert.throws(() => {
      ;(r.evento as { seq: number }).seq = 99
    })
    assert.equal(r.evento.seq, tamanho + 1)
  }
})

caso('RG-LOG-001: idempotência por clientEventId (reenvio offline não duplica o ponto)', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  const a = anexarEvento(j.log, { tipo: 'PONTO', payload: { equipe: 'A' }, clientEventId: 'cli-1' })
  if (!a.ok) throw new Error('esperado ok')
  const b = anexarEvento(a.log, { tipo: 'PONTO', payload: { equipe: 'A' }, clientEventId: 'cli-1' })
  if (!b.ok) throw new Error('esperado ok')
  assert.equal(b.duplicado, true)
  assert.equal(b.log.length, a.log.length)
  assert.equal(b.evento.seq, a.evento.seq)
  assert.deepEqual(derivarPlacar(b.log, c5).setAtual?.placar, { a: 1, b: 0 })
  const semId = anexarEvento(a.log, { tipo: 'PONTO', payload: { equipe: 'A' }, clientEventId: '' })
  assert.equal(semId.ok, false)
})

caso('RG-LOG-002: desfazer é um novo evento DESFAZ; o evento original permanece no log', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 3)
  const seqUltimo = j.add('PONTO', { equipe: 'B' })
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 3, b: 1 })
  const tamanho = j.log.length
  j.add('DESFAZ', {}, seqUltimo)
  assert.equal(j.log.length, tamanho + 1)
  assert.equal(j.log[seqUltimo - 1]?.tipo, 'PONTO')
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 3, b: 0 })
  assert.equal(eventosEfetivos(j.log).some((e) => e.seq === seqUltimo), false)
})

caso('RG-LOG-003: desfazer valida o alvo (existente, não desfeito, não é outro DESFAZ)', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  const ponto = j.add('PONTO', { equipe: 'A' })
  const desfaz = j.add('DESFAZ', {}, ponto)
  const nova = (desfazId: number | null) =>
    anexarEvento(j.log, { tipo: 'DESFAZ', payload: {}, clientEventId: `d-${Math.random()}`, desfazId })
  const dobro = nova(ponto)
  assert.equal(dobro.ok, false)
  if (!dobro.ok) assert.equal(dobro.codigo, 'RG-LOG-003')
  const sobreDesfaz = nova(desfaz)
  assert.equal(sobreDesfaz.ok, false)
  const inexistente = nova(999)
  assert.equal(inexistente.ok, false)
  if (!inexistente.ok) assert.equal(inexistente.codigo, 'RG-LOG-002')
  const semAlvo = nova(null)
  assert.equal(semAlvo.ok, false)
  const pontoComDesfaz = anexarEvento(j.log, { tipo: 'PONTO', payload: { equipe: 'A' }, clientEventId: 'p9', desfazId: 1 })
  assert.equal(pontoComDesfaz.ok, false)
})

caso('RG-LOG-003: desfazer o DESFAZ não existe, mas relançar o ponto restaura o placar', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  const ponto = j.add('PONTO', { equipe: 'A' })
  j.add('DESFAZ', {}, ponto)
  j.add('PONTO', { equipe: 'A' })
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 1, b: 0 })
})

caso('RG-LOG-004: validarLog detecta lacuna de seq e clientEventId repetido', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 2)
  assert.equal(validarLog(j.log), null)
  const furado = [j.log[0]!, j.log[2]!]
  assert.equal(validarLog(furado)?.codigo, 'RG-LOG-004')
})

/* ------------------------------- CJ-03 no log ------------------------------- */

caso('RG-ROT-002 / CJ-03: falta de rotação cancela só os pontos da faltosa e é auditável/reversível', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'A' }) // seq 2
  j.add('PONTO', { equipe: 'A' }) // 3
  j.add('PONTO', { equipe: 'B' }) // 4: B passa a sacar (momento da falta)
  j.add('PONTO', { equipe: 'B' }) // 5
  j.add('PONTO', { equipe: 'A' }) // 6
  j.add('PONTO', { equipe: 'B' }) // 7
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 3, b: 3 })
  const falta = j.add('FALTA_ROTACAO', { equipeFaltosa: 'B', momentoSeq: 4 })
  const p = derivarPlacar(j.log, c5)
  // O placar exato após o cancelamento é item [M] (CJ-03): não é afirmado aqui.
  assert.equal(p.saca, 'A')
  assert.equal(p.setAtual?.pontos.filter((x) => !x.cancelado && x.equipe === 'B').length, 0)
  assert.equal(p.houveCancelamentoDePontos, true)
  assert.equal(p.setAtual?.pontos.filter((x) => x.cancelado).length, 3)
  assert.ok(p.setAtual?.pontos.filter((x) => x.cancelado).every((x) => x.equipe === 'B'))
  // desfazer a retificação restaura os pontos (tudo auditável no log)
  j.add('DESFAZ', {}, falta)
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 3, b: 3 })
})

caso('RG-ROT-003: falta de rotação sem momento só dá ponto e saque', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'B' })
  j.add('FALTA_ROTACAO', { equipeFaltosa: 'B', momentoSeq: null })
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.setAtual?.placar, { a: 1, b: 1 })
  assert.equal(p.houveCancelamentoDePontos, false)
  assert.equal(p.saca, 'A')
})

caso('RG-POS-003: falta de posição dá ponto e saque, sem cancelar pontos', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('B', 2)
  j.add('FALTA_POSICAO', { equipeFaltosa: 'B' })
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.setAtual?.placar, { a: 1, b: 2 })
  assert.equal(p.saca, 'A')
})

caso('RG-SAN-002: penalidade vira ponto e saque ao adversário; amarelo não muda o placar', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('SANCAO', { equipe: 'A', membro: 'J:8', categoria: 'MENOR', sancao: 'AMARELO', pontoParaAdversario: false })
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 0, b: 0 })
  j.add('SANCAO', { equipe: 'A', membro: 'J:8', categoria: 'GROSSEIRA', sancao: 'PENALIDADE', pontoParaAdversario: true })
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.setAtual?.placar, { a: 0, b: 1 })
  assert.equal(p.saca, 'B')
})

caso('RG-SAN-010: penalidade entre sets é lançada no 0x0 do set seguinte', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 25)
  j.add('SANCAO', { equipe: 'A', membro: 'J:8', categoria: 'GROSSEIRA', sancao: 'PENALIDADE', pontoParaAdversario: true, entreSets: true })
  assert.deepEqual(derivarPlacar(j.log, c5).sets[0]?.placar, { a: 25, b: 0 })
  j.iniciarSet(2)
  assert.deepEqual(derivarPlacar(j.log, c5).setAtual?.placar, { a: 0, b: 1 })
})

caso('RG-SET-008 / RG-LIB-005: trocas de líbero não entram na soma de substituições; tempos e subs contam por equipe e set', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8, excepcional: true, motivo: 'LESAO' })
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 5, entra: 20 })
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 20, entra: 5 })
  j.add('TEMPO', { equipe: 'B' })
  const p = derivarPlacar(j.log, c5)
  const a = p.setAtual!.contadores.A
  assert.equal(a.substituicoesRegulares, 1)
  assert.equal(a.substituicoesExcepcionais, 1)
  assert.equal(a.trocasLibero, 2)
  assert.equal(p.setAtual!.contadores.B.tempos, 1)
  assert.deepEqual(p.formacaoA, [7, 8, 3, 4, 5, 6])
  j.iniciarSet(2) // sem fim de set: inconsistência; contadores do set 1 permanecem
  const depois = derivarPlacar(j.log, c5)
  assert.equal(depois.inconsistencias[0]?.codigo, 'RG-SET-001')
  assert.equal(depois.sets.length, 1)
  assert.equal(depois.setAtual!.contadores.A.trocasLibero, 2)
})

caso('RG-INT-004 / CJ-06(b): set anulado descarta seus pontos e é rejogado do 0x0 preservando o histórico', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 25)
  j.iniciarSet(2)
  j.pontos('A', 13)
  j.pontos('B', 9)
  j.add('INTERRUPCAO', { minutos: 45, motivo: 'goteira', acao: 'ANULAR_SET_E_REJOGAR' })
  j.add('SET_ANULADO', { motivo: 'goteira' })
  let p = derivarPlacar(j.log, c5)
  assert.equal(p.sets.length, 1)
  assert.equal(p.setsAnulados.length, 1)
  assert.deepEqual(p.setsAnulados[0]?.placar, { a: 13, b: 9 })
  assert.deepEqual(p.setsGanhos, { a: 1, b: 0 })
  j.iniciarSet(2)
  j.pontos('B', 1)
  p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.setAtual?.placar, { a: 0, b: 1 })
  assert.equal(p.observacoes.length, 1)
  assert.equal(p.inconsistencias.length, 0)
})

caso('RG-INT-005: interrupção acima de 4 h marca a partida para repetição', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 3)
  j.add('INTERRUPCAO', { minutos: 300, motivo: 'chuva', acao: 'REPETIR_PARTIDA' })
  assert.equal(derivarPlacar(j.log, c5).status, 'A_REPETIR')
})

caso('RG-WO-001: evento WO encerra a partida com 3x0 e 25x0 mantendo sets jogados', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 25)
  j.iniciarSet(2)
  j.pontos('A', 5)
  j.add('WO', { ausente: 'B' })
  const p = derivarPlacar(j.log, c5)
  assert.equal(p.status, 'WO')
  assert.equal(p.vencedor, 'A')
  assert.equal(p.wo?.parciaisRegistrados[0]?.a, 25)
  assert.deepEqual(p.wo?.setInterrompido, { numero: 2, placar: { a: 5, b: 0 } }, 'guarda o placar parcial do set interrompido')
  assert.deepEqual(p.wo?.placarPartida, { setsA: 3, setsB: 0 })
  assert.equal(p.wo?.setsLancadosComoWO, 2)
  j.add('PONTO', { equipe: 'B' })
  assert.equal(derivarPlacar(j.log, c5).inconsistencias.length, 1)
})

caso('RG-WO-004: WO duplo não tem vencedor', () => {
  const j = new Jogo()
  j.add('WO', { ausente: 'AMBAS' })
  const p = derivarPlacar(j.log, c5)
  assert.equal(p.status, 'WO')
  assert.equal(p.vencedor, null)
})

caso('RG-WO-005: equipe incompleta no set fecha o set com os pontos mantidos', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 12)
  j.pontos('B', 8)
  j.add('EQUIPE_INCOMPLETA', { equipe: 'B', escopo: 'SET' })
  const p = derivarPlacar(j.log, c5)
  assert.deepEqual(p.sets[0]?.placar, { a: 25, b: 8 })
  assert.deepEqual(p.setsGanhos, { a: 1, b: 0 })
})

caso('RG-SAN-012: equipe incompleta para o jogo encerra a partida', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.pontos('A', 12)
  j.pontos('B', 8)
  j.add('EQUIPE_INCOMPLETA', { equipe: 'B', escopo: 'JOGO' })
  const p = derivarPlacar(j.log, c5)
  assert.equal(p.status, 'ENCERRADA')
  assert.equal(p.vencedor, 'A')
})

encerrar('regras-volei-eventos')
