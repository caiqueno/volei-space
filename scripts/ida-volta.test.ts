import assert from 'node:assert/strict'
import { rodadaDaVolta, vencedorAgregado } from '../src/lib/ida-volta'
import { montarConfrontosAutomaticos } from '../src/lib/chave-grupos'
import { vencedoresDosAlimentadores } from '../src/lib/resultado-partida'
import { montarConfrontos } from '../src/lib/rodadas'

const grupos = [
  { id: 1, ordem: 1, classificados: [10, 11] },
  { id: 2, ordem: 2, classificados: [20, 21] },
]
const rounds = [{ fase: 'SEMIFINAL', slots: 2 }, { fase: 'FINAL', slots: 1 }]

const unico = montarConfrontosAutomaticos({
  grupos,
  faseInicial: 'SEMIFINAL',
  rounds,
  disputaTerceiro: false,
  existentes: [],
  partidas: [],
})
assert.equal(unico.length, 2)
assert.ok(unico.every((jogo) => jogo.rodada < 1000))

const idaVolta = montarConfrontosAutomaticos({
  grupos,
  faseInicial: 'SEMIFINAL',
  rounds,
  disputaTerceiro: false,
  existentes: [],
  partidas: [],
  idaVolta: true,
})
assert.equal(idaVolta.length, 4)
const volta = idaVolta.find((jogo) => jogo.rodada === rodadaDaVolta(1))
assert.ok(volta)
assert.equal(volta?.equipeAId, unico[0].equipeBId)
assert.equal(volta?.equipeBId, unico[0].equipeAId)

const ida = { rodada: 1, status: 'ENCERRADA', equipeAId: 10, equipeBId: 21, setsPorA: 2, setsPorB: 0, vencedorId: 10 }
const retornoAberto = { rodada: rodadaDaVolta(1), status: 'AGENDADA', equipeAId: 21, equipeBId: 10, setsPorA: null, setsPorB: null, vencedorId: null }
assert.equal(vencedoresDosAlimentadores([ida, retornoAberto, { ...ida, rodada: 2, equipeAId: 20, equipeBId: 11, vencedorId: 20 }], 1), null)

const retorno = { ...retornoAberto, status: 'ENCERRADA', setsPorA: 2, setsPorB: 0, vencedorId: 21 }
assert.equal(vencedorAgregado(ida, retorno), null)
const retornoCurto = { ...retorno, setsPorA: 1, setsPorB: 2, vencedorId: 10 }
const outra = { rodada: 2, status: 'ENCERRADA', equipeAId: 20, equipeBId: 11, setsPorA: 2, setsPorB: 0, vencedorId: 20 }
assert.deepEqual(vencedoresDosAlimentadores([ida, retornoCurto, outra], 1), [10, 20])

const quatro = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
const turno = montarConfrontos(quatro)
const returno = montarConfrontos(quatro, [], true)
assert.equal(returno.length, turno.length * 2)
assert.equal(returno[turno.length].a.id, turno[0].b.id)
assert.equal(returno[turno.length].b.id, turno[0].a.id)

console.log('Ida e volta passou: segunda partida, agregado e turno.')
