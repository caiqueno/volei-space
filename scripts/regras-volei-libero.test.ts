import {
  aplicarRedesignacaoLibero,
  aplicarTrocaLibero,
  consequenciaTrocaLiberoIlegal,
  criarEstadoEquipe,
  observacaoRedesignacao,
  PERFIL_FIVB_CBV,
  registrarRallyConcluido,
  validarRedesignacaoLibero,
  validarRegistroDeLiberos,
  validarSaqueDoLibero,
  validarSubstituicaoRegular,
  validarTrocaLibero,
  type ContextoTrocaLibero,
  type EstadoEquipe,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

// posições: 1=I(saque) 2=II 3=III 4=IV 5=V 6=VI  -> fundo: 1, 5, 6
const ELENCO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21]
const novo = (): EstadoEquipe => criarEstadoEquipe({ elenco: ELENCO, liberos: [20, 21], formacaoInicial: [1, 2, 3, 4, 5, 6] })
const ctx: ContextoTrocaLibero = { momento: 'BOLA_FORA' }

caso('RG-LIB-001: até 2 líberos, da relação nominal', () => {
  assert.equal(validarRegistroDeLiberos([20, 21], ELENCO).ok, true)
  assert.equal(validarRegistroDeLiberos([20, 21, 9], ELENCO).ok, false)
  assert.equal(validarRegistroDeLiberos([99], ELENCO).ok, false)
})

caso('RG-LIB-003: líbero só substitui jogador de fundo de quadra', () => {
  const frente = validarTrocaLibero(novo(), { sai: 2, entra: 20 }, ctx)
  assert.equal(frente.ok, false)
  if (!frente.ok) {
    assert.equal(frente.codigo, 'RG-LIB-003')
    assert.match(frente.mensagem, /fundo/)
  }
  assert.equal(validarTrocaLibero(novo(), { sai: 5, entra: 20 }, ctx).ok, true)
  assert.equal(validarTrocaLibero(novo(), { sai: 6, entra: 20 }, ctx).ok, true)
  assert.equal(validarTrocaLibero(novo(), { sai: 1, entra: 20 }, ctx).ok, true)
})

caso('RG-LIB-005: troca de líbero não consome substituição e não cria par', () => {
  const r = aplicarTrocaLibero(novo(), { sai: 5, entra: 20 }, ctx)
  assert.equal(r.resultado.ok, true)
  assert.equal(r.estado.regulares, 0)
  assert.deepEqual(r.estado.pares, [])
  assert.equal(r.estado.substituidoPorLibero, 5)
})

caso('RG-LIB-005: exige rally concluído entre duas trocas (exceto incapaz)', () => {
  const entrou = aplicarTrocaLibero(novo(), { sai: 5, entra: 20 }, ctx).estado
  const semRally = validarTrocaLibero(entrou, { sai: 20, entra: 5 }, ctx)
  assert.equal(semRally.ok, false)
  if (!semRally.ok) assert.equal(semRally.codigo, 'RG-LIB-005')
  assert.equal(validarTrocaLibero(entrou, { sai: 20, entra: 5 }, { ...ctx, excecaoRally: true }).ok, true)
  assert.equal(validarTrocaLibero(registrarRallyConcluido(entrou), { sai: 20, entra: 5 }, ctx).ok, true)
})

caso('RG-LIB-006 / CJ-08: líbero só sai para o regular da posição ou para o 2º líbero', () => {
  const entrou = registrarRallyConcluido(aplicarTrocaLibero(novo(), { sai: 5, entra: 20 }, ctx).estado)
  const errado = validarTrocaLibero(entrou, { sai: 20, entra: 7 }, ctx)
  assert.equal(errado.ok, false)
  if (!errado.ok) assert.equal(errado.codigo, 'RG-LIB-006')
  assert.equal(validarTrocaLibero(entrou, { sai: 20, entra: 5 }, ctx).ok, true)
  assert.equal(validarTrocaLibero(entrou, { sai: 20, entra: 21 }, ctx).ok, true)
})

caso('RG-LIB-002: só um líbero por vez em quadra', () => {
  const entrou = registrarRallyConcluido(aplicarTrocaLibero(novo(), { sai: 5, entra: 20 }, ctx).estado)
  const r = validarTrocaLibero(entrou, { sai: 6, entra: 21 }, ctx)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-LIB-002')
})

caso('RG-LIB-004: líbero na posição de saque não pode sacar', () => {
  const noSaque = aplicarTrocaLibero(novo(), { sai: 1, entra: 20 }, ctx).estado
  const r = validarSaqueDoLibero(noSaque)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-LIB-004')
  assert.equal(validarSaqueDoLibero(novo()).ok, true)
})

caso('RG-LIB-007: a 1ª troca do set exige papeleta conferida', () => {
  const r = validarTrocaLibero(novo(), { sai: 5, entra: 20 }, { ...ctx, primeiraTrocaDoSet: true, papeletaConferida: false })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-LIB-007')
  assert.equal(validarTrocaLibero(novo(), { sai: 5, entra: 20 }, { ...ctx, primeiraTrocaDoSet: true, papeletaConferida: true }).ok, true)
})

caso('RG-LIB-008: troca com a bola em jogo é bloqueada; após o apito é aviso', () => {
  const emJogo = validarTrocaLibero(novo(), { sai: 5, entra: 20 }, { momento: 'EM_JOGO' })
  assert.equal(emJogo.ok, false)
  if (!emJogo.ok) assert.equal(emJogo.codigo, 'RG-LIB-008')
  const aposApito = validarTrocaLibero(novo(), { sai: 5, entra: 20 }, { momento: 'APOS_APITO' })
  assert.equal(aposApito.ok, true)
  if (aposApito.ok) assert.equal(aposApito.avisos[0]?.codigo, 'RG-LIB-008')
})

caso('RG-LIB-009 / CJ-08: troca ilegal vira atraso se vista antes do rally, substituição ilegal após o saque', () => {
  assert.equal(consequenciaTrocaLiberoIlegal('ANTES_PROXIMO_RALLY').consequencia, 'CORRIGIR_E_ATRASO')
  assert.equal(consequenciaTrocaLiberoIlegal('APOS_SAQUE').consequencia, 'SUBSTITUICAO_ILEGAL')
})

caso('RG-LIB-005: substituição regular não aceita líbero e troca de líbero não aceita dois regulares', () => {
  assert.equal(validarSubstituicaoRegular(novo(), { sai: 5, entra: 20 }, PERFIL_FIVB_CBV).ok, false)
  assert.equal(validarTrocaLibero(novo(), { sai: 5, entra: 7 }, ctx).ok, false)
})

/* ------------------------------ CJ-02 redesignação ------------------------------ */

function cenarioCJ02(): EstadoEquipe {
  // equipe B com um só líbero (#10) na posição V, substituindo o regular #4
  const base = criarEstadoEquipe({
    elenco: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    liberos: [10],
    formacaoInicial: [1, 2, 3, 5, 4, 6],
  })
  return aplicarTrocaLibero(base, { sai: 4, entra: 10 }, ctx).estado
}
const ctxRed = { equipe: 'B' as const, numeroSet: 2, pontosEquipe: 9, pontosAdversario: 6 }

caso('RG-LIB-010 / CJ-02: redesigna-se jogador fora de quadra, nunca o regular substituído pelo líbero', () => {
  const e = cenarioCJ02()
  assert.equal(e.substituidoPorLibero, 4)
  const regular = validarRedesignacaoLibero(e, { liberoIncapaz: 10, novoLibero: 4, motivo: 'LESIONADO' })
  assert.equal(regular.ok, false)
  const emQuadra = validarRedesignacaoLibero(e, { liberoIncapaz: 10, novoLibero: 3, motivo: 'LESIONADO' })
  assert.equal(emQuadra.ok, false)
  assert.equal(validarRedesignacaoLibero(e, { liberoIncapaz: 10, novoLibero: 8, motivo: 'LESIONADO' }).ok, true)
})

caso('RG-LIB-011 / CJ-02: o novo líbero entra direto, o antigo não joga mais e não consome substituição', () => {
  const e = cenarioCJ02()
  const r = aplicarRedesignacaoLibero(e, { liberoIncapaz: 10, novoLibero: 8, motivo: 'LESIONADO' }, ctxRed)
  assert.equal(r.resultado.ok, true)
  assert.equal(r.estado.emQuadra[4], 8)
  assert.deepEqual(r.estado.liberos, [8])
  assert.deepEqual(r.estado.liberosIncapazes, [10])
  assert.equal(r.estado.regulares, 0)
  assert.equal(r.estado.substituidoPorLibero, 4)
  // o antigo não volta
  const volta = validarTrocaLibero(registrarRallyConcluido(r.estado), { sai: 6, entra: 10 }, ctx)
  assert.equal(volta.ok, false)
  // o redesignado pode ser redesignado de novo (19.4.2.4)
  assert.equal(validarRedesignacaoLibero(r.estado, { liberoIncapaz: 8, novoLibero: 9, motivo: 'LESIONADO' }).ok, true)
})

caso('RG-LIB-012: com dois líberos e um incapaz não há redesignação', () => {
  const r = validarRedesignacaoLibero(novo(), { liberoIncapaz: 20, novoLibero: 7, motivo: 'LESIONADO' })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-LIB-012')
})

caso('RG-LIB-013: observação da redesignação segue o modelo do Guia', () => {
  const texto = observacaoRedesignacao({ liberoIncapaz: 10, novoLibero: 2, motivo: 'LESIONADO' }, ctxRed)
  assert.equal(texto, 'REDESIGNAÇÃO DE LÍBERO, EQUIPE B, LÍBERO Nº 10 LESIONADO, NOVO LÍBERO JOGADOR Nº 2, 2º SET, PLACAR 9X6')
})

encerrar('regras-volei-libero')
