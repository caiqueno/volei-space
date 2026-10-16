import {
  anexarEvento,
  CONFIG_FIVB_MELHOR_DE_5,
  configMelhorDe3,
  derivarPlacar,
  jogadoresImpedidos,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const contexto: ContextoDerivacao = {
  elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], B: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
}
const c5 = CONFIG_FIVB_MELHOR_DE_5
const c3 = configMelhorDe3()

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
      ...(numeroSet === 1 ? { liberosA: [10], liberosB: [20] } : {}),
    })
  }

  pontos(equipe: Equipe, quantos: number): void {
    for (let i = 0; i < quantos; i += 1) this.add('PONTO', { equipe })
  }

  estado(config = c5) {
    return derivarPlacar(this.log, config, contexto)
  }
}

caso('RG-SUB-001: pares, contadores e entradas do set saem do log', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.pontos('A', 1)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8 })
  const a = j.estado().estadoEquipes!.A
  assert.equal(a.regulares, 2)
  assert.equal(a.excepcionais, 0)
  assert.deepEqual(a.pares, [
    { titular: 1, reserva: 7, retornou: false },
    { titular: 2, reserva: 8, retornou: false },
  ])
  assert.deepEqual(a.jaEntraramNoSet, [7, 8])
  assert.deepEqual(a.emQuadra, [7, 8, 3, 4, 5, 6])
  assert.equal(j.estado().estadoEquipes!.B.regulares, 0)
})

caso('RG-SUB-003: o retorno do titular fecha o par', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.pontos('A', 1)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 7, entra: 1 })
  const a = j.estado().estadoEquipes!.A
  assert.deepEqual(a.pares, [{ titular: 1, reserva: 7, retornou: true }])
  assert.equal(a.regulares, 2)
  assert.deepEqual(a.emQuadra, [1, 2, 3, 4, 5, 6])
})

caso('RG-SUB-007: o pedido de substituição só é liberado de novo depois de um rally concluído', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  assert.equal(j.estado().estadoEquipes!.A.pedidoNaInterrupcao, true)
  j.pontos('B', 1)
  assert.equal(j.estado().estadoEquipes!.A.pedidoNaInterrupcao, false)
})

caso('RG-LIB-005: rally concluído desde a última troca de líbero', () => {
  const j = new Jogo()
  j.iniciarSet()
  assert.equal(j.estado().estadoEquipes!.A.rallyConcluidoDesdeTrocaLibero, true)
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 10 })
  let a = j.estado().estadoEquipes!.A
  assert.equal(a.rallyConcluidoDesdeTrocaLibero, false)
  assert.equal(a.substituidoPorLibero, 6)
  assert.deepEqual(a.emQuadra, [1, 2, 3, 4, 5, 10])
  assert.equal(a.regulares, 0, 'troca de líbero não é substituição')
  j.pontos('B', 1)
  a = j.estado().estadoEquipes!.A
  assert.equal(a.rallyConcluidoDesdeTrocaLibero, true)
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 10, entra: 6 })
  a = j.estado().estadoEquipes!.A
  assert.equal(a.substituidoPorLibero, null)
  assert.equal(j.estado().inconsistencias.length, 0)
})

caso('RG-LIB-005: duas trocas sem rally no meio viram inconsistência na derivação', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 10 })
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 10, entra: 6 })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 1)
  assert.equal(p.inconsistencias[0]!.codigo, 'RG-LIB-005')
})

caso('RG-LIB-010: líbero redesignado fica incapaz e o novo assume a quadra', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 10 })
  j.pontos('B', 1)
  j.add('REDESIGNACAO_LIBERO', { equipe: 'A', liberoIncapaz: 10, novoLibero: 9 })
  const a = j.estado().estadoEquipes!.A
  assert.deepEqual(a.liberos, [9])
  assert.deepEqual(a.liberosIncapazes, [10])
  assert.ok(a.emQuadra.includes(9))
  assert.deepEqual(jogadoresImpedidos(a), [10])
})

caso('RG-SUB-011: substituição excepcional tem contador próprio e o lesionado não volta', () => {
  const j = new Jogo()
  j.iniciarSet()
  // Sem nenhuma substituição regular possível: todos os 4 reservas de linha já entraram? Aqui o
  // motor ainda aceita regular, então o log usa o limite para forçar a via excepcional.
  const cfg = { ...c5, perfil: { ...c5.perfil, limiteSubstituicoesPorSet: 0 } }
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7, excepcional: true, motivo: 'LESAO' })
  const a = derivarPlacar(j.log, cfg, contexto).estadoEquipes!.A
  assert.equal(a.excepcionais, 1)
  assert.equal(a.regulares, 0)
  assert.deepEqual(a.semRetorno, [1])
  assert.deepEqual(jogadoresImpedidos(a), [1])
})

caso('RG-SAN-007: expulsão vale só no set; desqualificação vale na partida', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SANCAO', { equipe: 'A', membro: 'J:2', categoria: 'OFENSIVA', sancao: 'EXPULSAO', pontoParaAdversario: false })
  j.add('SANCAO', { equipe: 'B', membro: 'J:12', categoria: 'AGRESSAO', sancao: 'DESQUALIFICACAO', pontoParaAdversario: false })
  let p = j.estado()
  assert.deepEqual(p.estadoEquipes!.A.expulsosNoSet, [2])
  assert.deepEqual(p.estadoEquipes!.B.desqualificados, [12])
  assert.equal(p.estadoEquipes!.sancoes.length, 2)
  j.pontos('A', 25)
  assert.equal(j.estado().setAtual!.encerrado, true)
  j.iniciarSet(2, 'B')
  p = j.estado()
  assert.deepEqual(p.estadoEquipes!.A.expulsosNoSet, [], 'expulsão não passa para o set seguinte')
  assert.deepEqual(p.estadoEquipes!.B.desqualificados, [12], 'desqualificação continua')
})

caso('RG-SAN-010: expulsão entre sets passa a valer no set seguinte', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.pontos('A', 25)
  j.add('SANCAO', { equipe: 'B', membro: 'J:13', categoria: 'OFENSIVA', sancao: 'EXPULSAO', pontoParaAdversario: false, entreSets: true })
  j.iniciarSet(2, 'B')
  assert.deepEqual(j.estado().estadoEquipes!.B.expulsosNoSet, [13])
})

caso('RG-SUB-014: novo set zera contadores e vínculos e mantém impedimentos da partida', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.add('TEMPO', { equipe: 'A' })
  j.pontos('A', 25)
  j.iniciarSet(2, 'B')
  const p = j.estado()
  assert.equal(p.estadoEquipes!.A.regulares, 0)
  assert.deepEqual(p.estadoEquipes!.A.pares, [])
  assert.deepEqual(p.estadoEquipes!.A.emQuadra, [1, 2, 3, 4, 5, 6])
  assert.equal(p.setAtual!.contadores.A.tempos, 0)
  assert.deepEqual(p.estadoEquipes!.A.liberos, [10], 'líberos da partida continuam')
})

caso('RG-LOG-006: desfazer a substituição restaura o estado da equipe', () => {
  const j = new Jogo()
  j.iniciarSet()
  const antes = j.estado().estadoEquipes!.A
  const seq = j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  assert.equal(j.estado().estadoEquipes!.A.regulares, 1)
  j.add('DESFAZ', {}, seq)
  assert.deepEqual(j.estado().estadoEquipes!.A, antes)
})

caso('RG-LOG-006: derivar duas vezes o mesmo log dá o mesmo estado', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'B', sai: 11, entra: 17 })
  j.pontos('B', 3)
  j.add('TROCA_LIBERO', { equipe: 'B', sai: 14, entra: 20 })
  assert.deepEqual(j.estado(), j.estado())
})

caso('RG-LOG-006: sem contexto o placar é o mesmo e não há estado de equipes', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.pontos('A', 5)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  const sem = derivarPlacar(j.log, c5)
  const com = j.estado()
  assert.equal(sem.estadoEquipes, null)
  assert.deepEqual({ ...com, estadoEquipes: null }, sem)
})

caso('RG-SUB-001: substituição inválida no log vira inconsistência sem quebrar o placar', () => {
  const j = new Jogo()
  j.iniciarSet()
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 99 }) // 99 não consta na relação nominal
  const p = j.estado(c3)
  assert.equal(p.inconsistencias[0]!.codigo, 'RG-FOR-009')
  assert.equal(p.setAtual!.contadores.A.substituicoesRegulares, 1)
})

encerrar('regras-volei-estado-derivado.test.ts')
