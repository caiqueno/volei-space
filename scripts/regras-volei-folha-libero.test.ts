import {
  anexarEvento,
  CONFIG_FIVB_MELHOR_DE_5,
  montarFolhaControleLibero,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5

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

  iniciar(liberosA?: number[], liberosB?: number[]): void {
    this.add('SET_INICIADO', {
      numeroSet: 1,
      formacaoA: [1, 2, 3, 4, 5, 6],
      formacaoB: [21, 22, 23, 24, 25, 26],
      saqueInicial: 'A',
      ...(liberosA ? { liberosA } : {}),
      ...(liberosB ? { liberosB } : {}),
    })
  }

  ponto(equipe: Equipe, vezes = 1): void {
    for (let i = 0; i < vezes; i += 1) this.add('PONTO', { equipe })
  }
}

caso('RG-LIB-014: cada troca vira uma linha com líbero, jogador regular, posição e placar da hora', () => {
  const j = new Jogo()
  j.iniciar([7], [27])
  j.ponto('A', 2)
  j.ponto('B')
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  const folha = montarFolhaControleLibero(j.log, c5)
  assert.equal(folha.total.A, 1)
  const l = folha.porSet[0]!.A[0]!
  assert.equal(l.libero, 7)
  assert.equal(l.troca, 6)
  assert.equal(l.posicao, 6)
  assert.equal(l.ordem, 1)
  assert.equal(l.placar.texto, '2X1')
  assert.equal(l.liberoInferido, false)
})

caso('RG-LIB-014: o placar traz primeiro os pontos da equipe que troca', () => {
  const j = new Jogo()
  j.iniciar([7], [27])
  j.ponto('A', 2)
  j.ponto('B', 3)
  j.add('TROCA_LIBERO', { equipe: 'B', sai: 25, entra: 27 })
  const l = montarFolhaControleLibero(j.log, c5).porSet[0]!.B[0]!
  assert.equal(l.placar.texto, '3X2')
  assert.equal(l.placar.equipe, 3)
  // B ganhou o saque no 1º ponto e girou uma vez: o 25, que era da posição V, está na IV.
  assert.equal(l.posicao, 4)
})

caso('RG-LIB-014: a saída do líbero registra o regular que volta e a ordem segue por equipe e set', () => {
  const j = new Jogo()
  j.iniciar([7], [27])
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  j.ponto('A')
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 7, entra: 6 })
  const linhas = montarFolhaControleLibero(j.log, c5).porSet[0]!.A
  assert.deepEqual(linhas.map((l) => [l.ordem, l.libero, l.troca]), [
    [1, 7, 6],
    [2, 7, 6],
  ])
})

caso('RG-LIB-014: entre dois líberos a coluna "Troca" fica em branco', () => {
  const j = new Jogo()
  j.iniciar([7, 8])
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  j.ponto('A')
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 7, entra: 8 })
  const linhas = montarFolhaControleLibero(j.log, c5).porSet[0]!.A
  assert.equal(linhas[1]!.libero, 8)
  assert.equal(linhas[1]!.troca, null)
})

caso('RG-LIB-014: troca desfeita não aparece na folha', () => {
  const j = new Jogo()
  j.iniciar([7])
  const seq = j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  j.add('DESFAZ', {}, seq)
  assert.equal(montarFolhaControleLibero(j.log, c5).linhas.length, 0)
})

caso('RG-LIB-014: a redesignação entra na folha com o líbero antigo e o novo (RG-LIB-013)', () => {
  const j = new Jogo()
  j.iniciar([10])
  j.ponto('B', 6)
  j.ponto('A', 9)
  j.add('REDESIGNACAO_LIBERO', { equipe: 'A', liberoIncapaz: 10, novoLibero: 2 })
  const folha = montarFolhaControleLibero(j.log, c5)
  const l = folha.linhas[0]!
  assert.equal(l.tipo, 'REDESIGNACAO')
  assert.equal(l.libero, 2)
  assert.equal(l.liberoSubstituido, 10)
  assert.equal(l.placar.texto, '9X6')
})

caso('RG-LIB-014: sem a relação de líberos registrada a linha sai marcada como inferida', () => {
  const j = new Jogo()
  j.iniciar()
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  const l = montarFolhaControleLibero(j.log, c5).linhas[0]!
  assert.equal(l.liberoInferido, true)
  assert.equal(l.libero, 7)
  assert.equal(l.troca, 6)
})

caso('RG-LIB-014: a folha agrupa por set e separa as equipes', () => {
  const j = new Jogo()
  j.iniciar([7], [27])
  j.add('TROCA_LIBERO', { equipe: 'A', sai: 6, entra: 7 })
  j.add('TROCA_LIBERO', { equipe: 'B', sai: 26, entra: 27 })
  const folha = montarFolhaControleLibero(j.log, c5)
  assert.equal(folha.porSet.length, 1)
  assert.equal(folha.porSet[0]!.numero, 1)
  assert.equal(folha.porSet[0]!.A.length, 1)
  assert.equal(folha.porSet[0]!.B.length, 1)
  assert.deepEqual(folha.total, { A: 1, B: 1 })
  assert.equal(montarFolhaControleLibero([], c5).linhas.length, 0)
})

encerrar('regras-volei-folha-libero')
