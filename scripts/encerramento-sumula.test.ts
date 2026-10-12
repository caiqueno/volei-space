import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  andamentoPodeGravar,
  aplicarAndamentoSeAberta,
  oficializarPartida,
  reconferirEncerramento,
  type EstadoEncerramento,
} from '../src/lib/encerramento-sumula'

const aberto: EstadoEncerramento = {
  status: 'EM_ANDAMENTO',
  sumulaAprovadaEm: null,
  setsPorA: 1,
  setsPorB: 0,
}
const oficial = { setsPorA: 2, setsPorB: 1, em: '2026-10-11T21:04:00.000Z' }

const gravouAberto = aplicarAndamentoSeAberta(aberto, { setsPorA: 2, setsPorB: 1 })
assert.equal(gravouAberto.gravou, true)
assert.equal(gravouAberto.estado.status, 'EM_ANDAMENTO')
assert.equal(gravouAberto.estado.setsPorA, 2)

const lidoPeloPut = { ...aberto, setsPorA: 2, setsPorB: 1 }
let banco = oficializarPartida(lidoPeloPut, oficial)
assert.equal(andamentoPodeGravar(lidoPeloPut), true)
assert.equal(andamentoPodeGravar(banco), false)

const putTardio = aplicarAndamentoSeAberta(banco, { setsPorA: 2, setsPorB: 0 })
assert.equal(putTardio.gravou, false)
assert.equal(putTardio.estado.status, 'ENCERRADA')
assert.equal(putTardio.estado.sumulaAprovadaEm, oficial.em)
assert.equal(putTardio.estado.setsPorA, 2)
assert.equal(putTardio.estado.setsPorB, 1)

const aprovadaSemStatus = aplicarAndamentoSeAberta(
  { status: 'EM_ANDAMENTO', sumulaAprovadaEm: oficial.em, setsPorA: 2, setsPorB: 1 },
  { setsPorA: 0, setsPorB: 0 },
)
assert.equal(aprovadaSemStatus.gravou, false)
assert.equal(aprovadaSemStatus.estado.setsPorA, 2)

let sincronizou = 1
const reaberta: EstadoEncerramento = { ...banco, status: 'EM_ANDAMENTO' }
const conferencia = reconferirEncerramento(reaberta, oficial)
if (conferencia.regravou) sincronizou += 1
assert.equal(conferencia.regravou, true)
assert.equal(conferencia.estado.status, 'ENCERRADA')
assert.equal(conferencia.estado.sumulaAprovadaEm, oficial.em)
assert.equal(sincronizou, 2)

const jaEncerrada = reconferirEncerramento(banco, oficial)
assert.equal(jaEncerrada.regravou, false)
assert.equal(jaEncerrada.estado, banco)

const gravacao = readFileSync('src/lib/sumula-gravacao.ts', 'utf8')
const rota = readFileSync('src/app/api/sumula/[token]/route.ts', 'utf8')
const tela = readFileSync('src/app/sumula/[token]/lancar/page.tsx', 'utf8')
assert.match(gravacao, /\.neq\('status', 'ENCERRADA'\)\s*\.is\('sumulaAprovadaEm', null\)/)
assert.match(gravacao, /protegerEncerrada/)
assert.match(rota, /Partida já encerrada', 409/)
assert.match(rota, /protegerEncerrada: true/)
assert.match(rota, /SumulaJaOficializada/)
assert.match(rota, /garantirEncerramento/)
assert.match(rota, /sincronizarVagasDaPartida/)
const envio = tela.slice(tela.indexOf('async function submitSumula'), tela.indexOf('if (loading)'))
const espera = envio.indexOf('aguardar()')
const post = envio.indexOf("method: 'POST'")
assert.ok(espera >= 0 && post >= 0 && espera < post)
assert.match(envio, /finalSubmitRef\.current = true/)
assert.match(tela, /if \(finalSubmitRef\.current \|\| rascunho\.sumulaAprovadaEm\) return null/)

console.log('encerramento-sumula: ok')
