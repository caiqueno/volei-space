import {
  anexarEvento,
  configMelhorDe3,
  derivarPlacar,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

// Sets curtos (3 pontos) só para o teste terminar rápido.
const cfg = configMelhorDe3({ alvoSet: 3, alvoSetDecisivo: 3 })
const CTX: ContextoDerivacao = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], B: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
  capitao: { A: 1, B: 11 },
}

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

  iniciarSet(numeroSet = 1, saqueInicial: Equipe = 'A'): number {
    return this.add('SET_INICIADO', {
      numeroSet,
      formacaoA: [1, 2, 3, 4, 5, 6],
      formacaoB: [11, 12, 13, 14, 15, 16],
      saqueInicial,
    })
  }

  /** A vence 2x0. */
  terminarComVitoriaDeA(): void {
    this.iniciarSet(2, 'B')
    for (let s = 0; s < 3; s += 1) this.add('PONTO', { equipe: 'A' })
  }

  estado() {
    return derivarPlacar(this.log, cfg, CTX)
  }
}

function jogoEncerrado(): Jogo {
  const j = new Jogo()
  j.iniciarSet(1)
  for (let i = 0; i < 3; i += 1) j.add('PONTO', { equipe: 'A' })
  return j
}

/* ------------------------------ RG-PRO-001 ------------------------------ */

caso('RG-PRO-001: o capitão em jogo anuncia o protesto durante a partida', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 11, motivo: 'interpretação de regra' })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.protestos[0]?.estado, 'ANUNCIADO')
  assert.equal(p.status, 'EM_ANDAMENTO', 'o protesto não paralisa nem decide o jogo')
})

caso('RG-PRO-001: quem não é capitão em jogo não anuncia o protesto', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 12 })
  const p = j.estado()
  assert.equal(p.inconsistencias[0]?.codigo, 'RG-PRO-001')
  assert.equal(p.protestos.length, 0)
})

caso('RG-PRO-001: depois do fim da partida já não se anuncia protesto', () => {
  const j = jogoEncerrado()
  j.terminarComVitoriaDeA()
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B' })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-PRO-001')
})

/* ------------------------------ RG-PRO-002 ------------------------------ */

caso('RG-PRO-002: o protesto anunciado é registrado ao fim com o relato, sem alterar o resultado', () => {
  const k = new Jogo()
  k.iniciarSet(1)
  k.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 11 })
  for (let i = 0; i < 3; i += 1) k.add('PONTO', { equipe: 'A' })
  k.terminarComVitoriaDeA()
  const antes = k.estado()
  assert.equal(antes.status, 'ENCERRADA')
  k.add('PROTESTO_REGISTRADO', { equipe: 'B', relato: 'O árbitro aplicou errado a regra do toque.' })
  const p = k.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.protestos[0]?.estado, 'REGISTRADO')
  assert.equal(p.protestos[0]?.relato, 'O árbitro aplicou errado a regra do toque.')
  assert.equal(p.status, antes.status, 'o motor não decide o mérito (RG-PRO-004)')
  assert.equal(p.vencedor, antes.vencedor)
  assert.deepEqual(p.setsGanhos, antes.setsGanhos)
})

caso('RG-PRO-002: o registro só vale ao fim da partida', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 11 })
  j.add('PROTESTO_REGISTRADO', { equipe: 'B', relato: 'cedo demais' })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-PRO-002')
})

caso('RG-PRO-002: exigir o anúncio prévio é configurável (item [M]); a flag governa o comportamento', () => {
  const montar = () => {
    const j = jogoEncerrado()
    j.terminarComVitoriaDeA()
    j.add('PROTESTO_REGISTRADO', { equipe: 'B', relato: 'sem anúncio' })
    return j
  }
  const exige = derivarPlacar(montar().log, configMelhorDe3({ alvoSet: 3, alvoSetDecisivo: 3, protestoExigeAnuncio: true }), CTX)
  assert.equal(exige.inconsistencias[0]?.codigo, 'RG-PRO-002')
  assert.equal(exige.protestos.length, 0)
  const livre = derivarPlacar(montar().log, configMelhorDe3({ alvoSet: 3, alvoSetDecisivo: 3, protestoExigeAnuncio: false }), CTX)
  assert.equal(livre.inconsistencias.length, 0)
  assert.equal(livre.protestos[0]?.estado, 'REGISTRADO')
})

caso('RG-PRO-002: o protesto pode ser registrado também depois de um WO', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 11 })
  j.add('WO', { ausente: 'B' })
  j.add('PROTESTO_REGISTRADO', { equipe: 'B', relato: 'discordo da decisão' })
  const p = j.estado()
  assert.equal(p.status, 'WO')
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.protestos[0]?.estado, 'REGISTRADO')
})

/* ------------------------------ RG-PRO-003 ------------------------------ */

caso('RG-PRO-003: o capitão pode desistir do protesto anunciado ao fim da partida', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PROTESTO_ANUNCIADO', { equipe: 'B', jogador: 11 })
  for (let i = 0; i < 3; i += 1) j.add('PONTO', { equipe: 'A' })
  j.terminarComVitoriaDeA()
  j.add('PROTESTO_DESISTIDO', { equipe: 'B' })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.protestos[0]?.estado, 'DESISTIDO')
  assert.ok(p.protestos[0]?.resolvidoEm)
})

caso('RG-PRO-003: não há o que desistir sem protesto anunciado', () => {
  const j = jogoEncerrado()
  j.terminarComVitoriaDeA()
  j.add('PROTESTO_DESISTIDO', { equipe: 'B' })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-PRO-003')
})

/* ---------------------- RG-INT-001/002: rally repetido ---------------------- */

caso('RG-INT-001: rally repetido por acidente não dá ponto e mantém o sacador e as formações', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'B' }) // B passa a sacar e roda
  const antes = j.estado()
  j.add('RALLY_REPETIDO', { motivo: 'ACIDENTE_COM_BOLA_EM_JOGO' })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.deepEqual(p.setAtual?.placar, antes.setAtual?.placar)
  assert.equal(p.saca, antes.saca)
  assert.deepEqual(p.formacaoA, antes.formacaoA)
  assert.deepEqual(p.formacaoB, antes.formacaoB)
  assert.equal(p.setAtual?.rallysRepetidos, 1)
  assert.equal(p.setAtual?.pontos.length, antes.setAtual?.pontos.length)
})

caso('RG-INT-002: interferência externa repete o rally sem ponto e sem trocar o sacador', () => {
  const j = new Jogo()
  j.iniciarSet(1, 'B')
  j.add('RALLY_REPETIDO', { motivo: 'INTERFERENCIA_EXTERNA' })
  j.add('RALLY_REPETIDO', {})
  const p = j.estado()
  assert.deepEqual(p.setAtual?.placar, { a: 0, b: 0 })
  assert.equal(p.saca, 'B')
  assert.equal(p.setAtual?.rallysRepetidos, 2)
})

caso('RG-INT-001: rally repetido não conta como rally concluído (não libera outro pedido de substituição)', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.add('RALLY_REPETIDO', {})
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8 })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-SUB-007')
})

caso('RG-INT-001: rally repetido sem set em andamento é inconsistência', () => {
  const j = jogoEncerrado()
  j.add('RALLY_REPETIDO', {})
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-INT-001')
})

encerrar('regras-volei-protesto')
