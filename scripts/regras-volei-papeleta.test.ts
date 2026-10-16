import {
  anexarEvento,
  CONFIG_FIVB_MELHOR_DE_5,
  compararComPapeleta,
  consequenciaDeDiscrepancia,
  derivarPlacar,
  validarDesignacaoDeCapitao,
  validarMudancaDeFormacao,
  type ContextoDerivacao,
  type Equipe,
  type NovoEvento,
  type PayloadPorTipo,
  type SumulaEvento,
  type SumulaEventoTipo,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const c5 = CONFIG_FIVB_MELHOR_DE_5
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

  estado(ctx: ContextoDerivacao | undefined = CTX) {
    return derivarPlacar(this.log, c5, ctx)
  }
}

/* ------------------------------ RG-FOR-006 ------------------------------ */

caso('RG-FOR-006: a formação entregue só muda por substituição regular', () => {
  const papeleta = [1, 2, 3, 4, 5, 6]
  assert.equal(validarMudancaDeFormacao({ papeleta, nova: [1, 2, 3, 4, 5, 6], viaSubstituicaoRegular: false }).ok, true)
  const troca = validarMudancaDeFormacao({ papeleta, nova: [7, 2, 3, 4, 5, 6], viaSubstituicaoRegular: false })
  assert.equal(troca.ok, false)
  if (!troca.ok) assert.equal(troca.codigo, 'RG-FOR-006')
  assert.equal(validarMudancaDeFormacao({ papeleta, nova: [7, 2, 3, 4, 5, 6], viaSubstituicaoRegular: true }).ok, true)
})

caso('RG-FOR-006: um segundo SET_INICIADO do mesmo set não substitui a papeleta entregue', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('SET_INICIADO', { numeroSet: 1, formacaoA: [7, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A' })
  const p = j.estado()
  assert.equal(p.inconsistencias[0]?.codigo, 'RG-FOR-006')
  assert.deepEqual(p.setAtual?.formacaoInicialA, [1, 2, 3, 4, 5, 6])
})

caso('RG-FOR-006: antes do set a correção não pode mudar um jogador da papeleta', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'ANTES_DO_SET', causa: 'POSICAO', formacaoCorrigida: [2, 1, 3, 4, 5, 6] })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-FOR-006')
})

/* ------------------------------ detecção ------------------------------ */

caso('RG-FOR-007/008/009: compara a papeleta com a quadra e classifica a causa', () => {
  const papeleta = [1, 2, 3, 4, 5, 6]
  const elenco = [1, 2, 3, 4, 5, 6, 7, 8]
  assert.deepEqual(compararComPapeleta(papeleta, [1, 2, 3, 4, 5, 6], elenco), [])
  const trocadas = compararComPapeleta(papeleta, [2, 1, 3, 4, 5, 6], elenco)
  assert.deepEqual(trocadas.map((d) => d.causa), ['POSICAO', 'POSICAO'])
  assert.equal(compararComPapeleta(papeleta, [7, 2, 3, 4, 5, 6], elenco)[0]?.causa, 'JOGADOR_FORA_DA_PAPELETA')
  assert.equal(compararComPapeleta(papeleta, [99, 2, 3, 4, 5, 6], elenco)[0]?.causa, 'JOGADOR_NAO_REGISTRADO')
})

caso('RG-FOR-007/008/009: consequência por fase e causa', () => {
  const antes = consequenciaDeDiscrepancia('ANTES_DO_SET', 'POSICAO')
  assert.equal(antes.codigo, 'RG-FOR-007')
  assert.equal(antes.sancao, false)
  assert.equal(antes.cancelaPontosDaFaltosa, false)
  assert.equal(antes.pontoESaqueParaAdversario, false)
  assert.equal(consequenciaDeDiscrepancia('DEPOIS_DO_INICIO', 'POSICAO').codigo, 'RG-FOR-008')
  assert.equal(consequenciaDeDiscrepancia('DEPOIS_DO_INICIO', 'JOGADOR_NAO_REGISTRADO').codigo, 'RG-FOR-009')
  assert.equal(consequenciaDeDiscrepancia('DEPOIS_DO_INICIO', 'JOGADOR_FORA_DA_PAPELETA').pontoESaqueParaAdversario, true)
})

/* ------------------------------ RG-FOR-007 ------------------------------ */

caso('RG-FOR-007: discrepância antes do início corrige sem sanção, sem ponto e sem mexer na rotação', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'ANTES_DO_SET', causa: 'JOGADOR_FORA_DA_PAPELETA', jogador: 7 })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.deepEqual(p.setAtual?.placar, { a: 0, b: 0 })
  assert.deepEqual(p.formacaoA, [1, 2, 3, 4, 5, 6])
  assert.equal(p.saca, 'A')
  assert.equal(p.discrepanciasPapeleta[0]?.codigo, 'RG-FOR-007')
  assert.equal(p.houveCancelamentoDePontos, false)
})

caso('RG-FOR-007: depois que o set começou a fase ANTES_DO_SET não vale', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'A' })
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'ANTES_DO_SET', causa: 'POSICAO' })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-FOR-008')
})

/* ------------------------------ RG-FOR-008 ------------------------------ */

caso('RG-FOR-008: discrepância depois do início cancela os pontos da faltosa, mantém os do adversário e refaz o rodízio', () => {
  const j = new Jogo()
  j.iniciarSet(1) // A saca
  j.add('PONTO', { equipe: 'B' }) // 2: side-out de B
  j.add('PONTO', { equipe: 'A' }) // 3: side-out de A (momento da falta)
  j.add('PONTO', { equipe: 'A' }) // 4
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'DEPOIS_DO_INICIO', causa: 'POSICAO', momentoSeq: 3 })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  const pontos = p.setAtual!.pontos
  assert.equal(pontos.filter((x) => !x.cancelado && x.equipe === 'A').length, 0)
  assert.ok(pontos.some((x) => x.seq === 2 && !x.cancelado && x.equipe === 'B'), 'o ponto do adversário permanece')
  assert.ok(pontos.some((x) => x.origem === 'PAPELETA' && x.equipe === 'B'), 'o adversário ganha ponto')
  assert.equal(p.saca, 'B')
  assert.deepEqual(p.formacaoA, [1, 2, 3, 4, 5, 6])
  assert.equal(p.discrepanciasPapeleta[0]?.codigo, 'RG-FOR-008')
  assert.equal(p.houveCancelamentoDePontos, true)
})

caso('RG-FOR-008: desfazer a discrepância restaura os pontos (auditável)', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'A' })
  j.add('PONTO', { equipe: 'A' })
  const d = j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'DEPOIS_DO_INICIO', causa: 'POSICAO', momentoSeq: 2 })
  assert.equal(j.estado().setAtual?.pontos.filter((x) => !x.cancelado && x.equipe === 'A').length, 0)
  j.add('DESFAZ', {}, d)
  assert.deepEqual(j.estado().setAtual?.placar, { a: 2, b: 0 })
})

/* ------------------------------ RG-FOR-009 ------------------------------ */

caso('RG-FOR-009: jogador não registrado em quadra aplica a reversão e registra o código', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'B' }) // 2
  j.add('PONTO', { equipe: 'A' }) // 3
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'DEPOIS_DO_INICIO', causa: 'JOGADOR_NAO_REGISTRADO', jogador: 99, momentoSeq: 3 })
  const p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.discrepanciasPapeleta[0]?.codigo, 'RG-FOR-009')
  assert.equal(p.setAtual?.pontos.filter((x) => !x.cancelado && x.equipe === 'A').length, 0)
  assert.equal(p.saca, 'B')
})

caso('RG-FOR-009: quem consta na relação nominal não é jogador não registrado', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('PONTO', { equipe: 'A' })
  j.add('DISCREPANCIA_PAPELETA', { equipe: 'A', fase: 'DEPOIS_DO_INICIO', causa: 'JOGADOR_NAO_REGISTRADO', jogador: 7, momentoSeq: 2 })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-FOR-009')
})

/* ------------------------------ RG-ELE-005 ------------------------------ */

caso('RG-ELE-005: o capitão em quadra é o capitão em jogo; fora de quadra falta designar', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  assert.deepEqual(j.estado().capitaesEmJogo, { A: 1, B: 11 })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  assert.deepEqual(j.estado().capitaesEmJogo, { A: null, B: 11 })
})

caso('RG-ELE-005: a designação vale até o designado sair e o capitão que volta reassume', () => {
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 1, entra: 7 })
  j.add('CAPITAO_EM_JOGO', { equipe: 'A', jogador: 2 })
  let p = j.estado()
  assert.equal(p.inconsistencias.length, 0, JSON.stringify(p.inconsistencias))
  assert.equal(p.capitaesEmJogo.A, 2)
  j.add('PONTO', { equipe: 'A' }) // conclui rally
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 2, entra: 8 })
  assert.equal(j.estado().capitaesEmJogo.A, null, 'o designado saiu')
  j.add('PONTO', { equipe: 'A' })
  j.add('SUBSTITUICAO', { equipe: 'A', sai: 7, entra: 1 }) // o capitão volta
  p = j.estado()
  assert.equal(p.capitaesEmJogo.A, 1)
})

caso('RG-ELE-005: não se designa capitão em jogo com o capitão em quadra nem jogador fora de quadra', () => {
  const emQuadra = [1, 2, 3, 4, 5, 6]
  const comCapitao = validarDesignacaoDeCapitao({ capitao: 1, designado: 2, emQuadra })
  assert.equal(comCapitao.ok, false)
  const foraDeQuadra = validarDesignacaoDeCapitao({ capitao: 9, designado: 8, emQuadra })
  assert.equal(foraDeQuadra.ok, false)
  assert.equal(validarDesignacaoDeCapitao({ capitao: 9, designado: 2, emQuadra }).ok, true)
  const impedido = validarDesignacaoDeCapitao({ capitao: 9, designado: 2, emQuadra, impedidos: [2] })
  assert.equal(impedido.ok, false)
  const j = new Jogo()
  j.iniciarSet(1)
  j.add('CAPITAO_EM_JOGO', { equipe: 'A', jogador: 2 })
  assert.equal(j.estado().inconsistencias[0]?.codigo, 'RG-ELE-005')
})

encerrar('regras-volei-papeleta')
