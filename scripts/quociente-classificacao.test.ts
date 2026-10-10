import assert from 'node:assert/strict'
import { criteriosPersistiveis, erroRecusaQuociente, normalizarCriterios, ordenarClassificacao } from '../src/lib/classificacao'

function linha(parcial: { equipeId: number; setsPro: number; setsContra: number; pontosPro: number; pontosContra: number; pontos?: number; vitorias?: number }) {
  return {
    equipeId: parcial.equipeId,
    categoriaCampeonatoId: null,
    categoria: 'GERAL',
    pontos: parcial.pontos ?? 3,
    jogos: 1,
    vitorias: parcial.vitorias ?? 1,
    derrotas: 0,
    setsPro: parcial.setsPro,
    setsContra: parcial.setsContra,
    pontosPro: parcial.pontosPro,
    pontosContra: parcial.pontosContra,
    punicoes: 0,
  }
}

const melhorMedia = linha({ equipeId: 2, setsPro: 2, setsContra: 0, pontosPro: 50, pontosContra: 40 })
const mediaMenor = linha({ equipeId: 1, setsPro: 4, setsContra: 2, pontosPro: 100, pontosContra: 80 })

assert.deepEqual(normalizarCriterios(null), ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'])
const padrao = ordenarClassificacao([melhorMedia, mediaMenor], ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'])
assert.deepEqual(padrao.map((item) => item.equipeId), [1, 2])

const porSets = ordenarClassificacao([mediaMenor, melhorMedia], ['PONTOS', 'SET_AVERAGE'])
assert.deepEqual(porSets.map((item) => item.equipeId), [2, 1])

const porPontos = ordenarClassificacao([
  linha({ equipeId: 1, setsPro: 2, setsContra: 1, pontosPro: 50, pontosContra: 40 }),
  linha({ equipeId: 2, setsPro: 2, setsContra: 1, pontosPro: 75, pontosContra: 50 }),
], ['PONTOS', 'SALDO_SETS', 'POINT_AVERAGE'])
assert.equal(porPontos[0].equipeId, 2)

const guardado = criteriosPersistiveis('["PONTOS","SET_AVERAGE","POINT_AVERAGE"]')
assert.equal(guardado, '["PONTOS"]')
assert.equal(criteriosPersistiveis('["PONTOS","VITORIAS"]'), '["PONTOS","VITORIAS"]')
assert.equal(erroRecusaQuociente({ code: '23514', message: 'violates check constraint' }), true)
assert.equal(erroRecusaQuociente({ code: '23505', message: 'duplicado' }), false)

console.log('Quociente passou: média de sets, média de pontos e critério padrão.')
