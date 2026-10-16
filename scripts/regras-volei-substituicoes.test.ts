import {
  aplicarSubstituicaoExcepcional,
  aplicarSubstituicaoRegular,
  caminhoParaJogadorImpedido,
  criarEstadoEquipe,
  iniciarNovoSet,
  PERFIL_AMADOR,
  PERFIL_FIVB_CBV,
  registrarRallyConcluido,
  resolverSemSubstituto,
  totalSubstituicoes,
  validarSubstituicaoExcepcional,
  validarSubstituicaoRegular,
  type EstadoEquipe,
  type PerfilRegras,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

const ELENCO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21]
const novo = (): EstadoEquipe => criarEstadoEquipe({ elenco: ELENCO, liberos: [20, 21], formacaoInicial: [1, 2, 3, 4, 5, 6] })

/** Aplica uma sub e já conclui um rally (libera o próximo pedido). */
function sub(estado: EstadoEquipe, sai: number, entra: number, perfil: PerfilRegras): EstadoEquipe {
  const r = aplicarSubstituicaoRegular(estado, { sai, entra }, perfil)
  assert.equal(r.resultado.ok, true, `sub ${sai}->${entra} deveria ser válida`)
  return registrarRallyConcluido(r.estado)
}

caso('RG-SUB-001: perfil FIVB/CBV permite 6 e bloqueia a 7ª substituição por set', () => {
  let e = novo()
  const entradas: Array<[number, number]> = [[1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]]
  for (const [sai, entra] of entradas) e = sub(e, sai, entra, PERFIL_FIVB_CBV)
  assert.equal(e.regulares, 6)
  const setima = validarSubstituicaoRegular(e, { sai: 7, entra: 1 }, PERFIL_FIVB_CBV)
  assert.equal(setima.ok, false)
  if (!setima.ok) {
    assert.equal(setima.codigo, 'RG-SUB-001')
    assert.match(setima.mensagem, /6 substituições/)
  }
})

caso('RG-SUB-001: perfil amador permite até 8 com alerta de ilegalidade acima de 6; a 9ª é bloqueada', () => {
  let e = novo()
  const entradas: Array<[number, number]> = [[1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]]
  for (const [sai, entra] of entradas) {
    const r = validarSubstituicaoRegular(e, { sai, entra }, PERFIL_AMADOR)
    assert.equal(r.ok && r.avisos.length, 0, 'até a 6ª não há alerta')
    e = sub(e, sai, entra, PERFIL_AMADOR)
  }
  const setima = validarSubstituicaoRegular(e, { sai: 7, entra: 1 }, PERFIL_AMADOR)
  assert.equal(setima.ok, true)
  if (setima.ok) assert.equal(setima.avisos[0]?.codigo, 'RG-SUB-001')
  e = sub(e, 7, 1, PERFIL_AMADOR)
  e = sub(e, 8, 2, PERFIL_AMADOR)
  assert.equal(e.regulares, 8)
  const nona = validarSubstituicaoRegular(e, { sai: 9, entra: 3 }, PERFIL_AMADOR)
  assert.equal(nona.ok, false)
  if (!nona.ok) assert.equal(nona.codigo, 'RG-SUB-001')
})

caso('RG-SUB-002: cada entrada e cada retorno contam como uma substituição', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  e = sub(e, 7, 1, PERFIL_FIVB_CBV)
  assert.equal(e.regulares, 2)
})

caso('RG-SUB-003: titular sai uma vez e volta uma vez; o 2º ciclo é bloqueado no perfil oficial', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  e = sub(e, 7, 1, PERFIL_FIVB_CBV)
  const segunda = validarSubstituicaoRegular(e, { sai: 1, entra: 7 }, PERFIL_FIVB_CBV)
  assert.equal(segunda.ok, false)
  if (!segunda.ok) assert.equal(segunda.codigo, 'RG-SUB-003')
})

caso('RG-SUB-003: perfil amador permite repetir o par (D3) sinalizando o aviso', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_AMADOR)
  e = sub(e, 7, 1, PERFIL_AMADOR)
  const segunda = validarSubstituicaoRegular(e, { sai: 1, entra: 7 }, PERFIL_AMADOR)
  assert.equal(segunda.ok, true)
  if (segunda.ok) assert.equal(segunda.avisos[0]?.codigo, 'RG-SUB-003')
})

caso('RG-SUB-004: reserva só é substituído pelo titular que ele substituiu', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  const terceiro = validarSubstituicaoRegular(e, { sai: 7, entra: 8 }, PERFIL_FIVB_CBV)
  assert.equal(terceiro.ok, false)
  if (!terceiro.ok) assert.equal(terceiro.codigo, 'RG-SUB-004')
  assert.equal(validarSubstituicaoRegular(e, { sai: 7, entra: 1 }, PERFIL_FIVB_CBV).ok, true)
})

caso('RG-SUB-004: reserva que já jogou no set não entra de novo por outro titular', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  e = sub(e, 7, 1, PERFIL_FIVB_CBV)
  const r = validarSubstituicaoRegular(e, { sai: 2, entra: 7 }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
})

caso('RG-SUB-004: titular que já saiu só volta ao seu lugar, não entra no de outro', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  const r = validarSubstituicaoRegular(e, { sai: 2, entra: 1 }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
})

caso('RG-SUB-007: dois pedidos sem rally concluído entre eles são bloqueados', () => {
  const e = novo()
  const primeira = aplicarSubstituicaoRegular(e, { sai: 1, entra: 7 }, PERFIL_FIVB_CBV)
  assert.equal(primeira.resultado.ok, true)
  const segunda = validarSubstituicaoRegular(primeira.estado, { sai: 2, entra: 8 }, PERFIL_FIVB_CBV)
  assert.equal(segunda.ok, false)
  if (!segunda.ok) assert.equal(segunda.codigo, 'RG-SUB-007')
  assert.equal(validarSubstituicaoRegular(registrarRallyConcluido(primeira.estado), { sai: 2, entra: 8 }, PERFIL_FIVB_CBV).ok, true)
})

caso('RG-FOR-009: jogador fora da relação nominal não entra', () => {
  const r = validarSubstituicaoRegular(novo(), { sai: 1, entra: 99 }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-FOR-009')
})

caso('RG-LIB-006: líbero não entra por substituição regular (é troca de líbero)', () => {
  const r = validarSubstituicaoRegular(novo(), { sai: 5, entra: 20 }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-LIB-006')
})

caso('RG-SUB-014: novo set zera contagem e vínculos de pares', () => {
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  e = sub(e, 7, 1, PERFIL_FIVB_CBV)
  const s2 = iniciarNovoSet(e, [1, 2, 3, 4, 5, 6])
  assert.equal(s2.regulares, 0)
  assert.deepEqual(s2.pares, [])
  assert.equal(validarSubstituicaoRegular(s2, { sai: 1, entra: 7 }, PERFIL_FIVB_CBV).ok, true)
})

/* ---------------------------- CJ-01 / excepcional --------------------------- */

function cenarioCJ01(): EstadoEquipe {
  // 6 regulares usadas: cinco entradas e um retorno. O 12 nunca entrou; o 5 segue em quadra.
  let e = novo()
  e = sub(e, 1, 7, PERFIL_FIVB_CBV)
  e = sub(e, 2, 8, PERFIL_FIVB_CBV)
  e = sub(e, 3, 9, PERFIL_FIVB_CBV)
  e = sub(e, 4, 10, PERFIL_FIVB_CBV)
  e = sub(e, 6, 11, PERFIL_FIVB_CBV)
  e = sub(e, 7, 1, PERFIL_FIVB_CBV)
  return e
}

caso('RG-SUB-011 / CJ-01: com 6 regulares usadas, lesão libera a substituição excepcional', () => {
  const e = cenarioCJ01()
  assert.equal(e.regulares, 6)
  assert.equal(validarSubstituicaoRegular(e, { sai: 5, entra: 12 }, PERFIL_FIVB_CBV).ok, false)
  const r = aplicarSubstituicaoExcepcional(e, { sai: 5, entra: 12, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  assert.equal(r.resultado.ok, true)
  assert.ok(r.estado.emQuadra.includes(12) && !r.estado.emQuadra.includes(5))
})

caso('RG-SUB-010 / CJ-01: excepcional tem contador próprio e entra no total do set', () => {
  const e = cenarioCJ01()
  const r = aplicarSubstituicaoExcepcional(e, { sai: 5, entra: 12, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  assert.equal(r.estado.regulares, 6)
  assert.equal(r.estado.excepcionais, 1)
  assert.equal(totalSubstituicoes(r.estado), 7)
})

caso('RG-SUB-011 / CJ-01: o lesionado não volta mais à partida, nem em outro set', () => {
  const e = cenarioCJ01()
  const r = aplicarSubstituicaoExcepcional(e, { sai: 5, entra: 12, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  const volta = validarSubstituicaoRegular(registrarRallyConcluido(r.estado), { sai: 12, entra: 5 }, PERFIL_FIVB_CBV)
  assert.equal(volta.ok, false)
  if (!volta.ok) assert.equal(volta.codigo, 'RG-SUB-011')
  const proximoSet = iniciarNovoSet(r.estado, [1, 2, 3, 4, 12, 6])
  const voltaSet2 = validarSubstituicaoRegular(proximoSet, { sai: 12, entra: 5 }, PERFIL_FIVB_CBV)
  assert.equal(voltaSet2.ok, false)
})

caso('RG-SUB-011 / CJ-01: excepcional não aceita líbero nem o regular que o líbero substitui', () => {
  const e = cenarioCJ01()
  const comLibero = { ...e, emQuadra: [1, 2, 3, 20, 5, 6], substituidoPorLibero: 4 }
  const r1 = validarSubstituicaoExcepcional(e, { sai: 5, entra: 20, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  assert.equal(r1.ok, false)
  const r2 = validarSubstituicaoExcepcional({ ...comLibero, emQuadra: [1, 2, 3, 20, 5, 6] }, { sai: 5, entra: 4, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  assert.equal(r2.ok, false)
})

caso('RG-SUB-011: excepcional só vale quando não há substituição regular possível', () => {
  const r = validarSubstituicaoExcepcional(novo(), { sai: 5, entra: 12, motivo: 'LESAO' }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.codigo, 'RG-SUB-011')
    assert.match(r.mensagem, /substituição regular possível/)
  }
})

caso('RG-SUB-011: excepcional exige motivo válido', () => {
  const r = validarSubstituicaoExcepcional(
    cenarioCJ01(),
    { sai: 5, entra: 12, motivo: 'TATICA' as never },
    PERFIL_FIVB_CBV,
  )
  assert.equal(r.ok, false)
})

caso('RG-SUB-012: expulso/desqualificado em quadra segue substituição legal, depois excepcional, depois incompleta', () => {
  const e = novo()
  assert.equal(caminhoParaJogadorImpedido(e, 5, 'EXPULSAO', PERFIL_FIVB_CBV).via, 'REGULAR')
  const limite = cenarioCJ01()
  assert.equal(caminhoParaJogadorImpedido(limite, 5, 'EXPULSAO', PERFIL_FIVB_CBV).via, 'EXCEPCIONAL')
  const semBanco = criarEstadoEquipe({ elenco: [1, 2, 3, 4, 5, 6, 20], liberos: [20], formacaoInicial: [1, 2, 3, 4, 5, 6] })
  assert.equal(caminhoParaJogadorImpedido(semBanco, 5, 'DESQUALIFICACAO', PERFIL_FIVB_CBV).via, 'INCOMPLETA')
})

caso('RG-SUB-013: sem substituto, lesão dá 3 min de recuperação uma vez por jogador; depois equipe incompleta', () => {
  const e = novo()
  const primeira = resolverSemSubstituto(e, 5, 'LESAO')
  assert.equal(primeira.acao, 'RECUPERACAO_3_MIN')
  const usada = { ...e, recuperacaoUsada: [5] }
  assert.equal(resolverSemSubstituto(usada, 5, 'LESAO').acao, 'EQUIPE_INCOMPLETA')
  assert.equal(resolverSemSubstituto(e, 5, 'EXPULSAO').acao, 'EQUIPE_INCOMPLETA')
})

caso('RG-SUB-008: substituição antes do set conta como regular do set', () => {
  // O pedido antes do início usa o mesmo caminho e consome a cota do set (15.3.2).
  const r = aplicarSubstituicaoRegular(novo(), { sai: 1, entra: 7 }, PERFIL_FIVB_CBV)
  assert.equal(r.estado.regulares, 1)
})

encerrar('regras-volei-substituicoes')
