import assert from 'node:assert/strict'
import { escolherPartidaDestaque, mostrarProximoJogo } from '../src/lib/proximo-jogo'

const aoVivo = [{ id: 1, status: 'EM_ANDAMENTO' }]
const proximos = [{ id: 2, status: 'AGENDADA' }]
const encerradas = [{ id: 3, status: 'ENCERRADA' }]

assert.equal(escolherPartidaDestaque({ aoVivo, proximos }, 'FINALIZADO'), null)
assert.equal(escolherPartidaDestaque({ aoVivo: [], proximos }, 'ATIVA')?.id, 2)
assert.equal(escolherPartidaDestaque({ aoVivo: [], proximos: [] }, 'ATIVA'), null)
assert.equal(mostrarProximoJogo({ statusCampeonato: 'FINALIZADO', emAndamento: false, temJogoPendente: true }), false)
assert.equal(mostrarProximoJogo({ statusCampeonato: 'ATIVA', emAndamento: false, temJogoPendente: false }), false)
assert.equal(mostrarProximoJogo({ statusCampeonato: 'ATIVA', emAndamento: true, temJogoPendente: true }), true)
assert.equal(mostrarProximoJogo({ statusCampeonato: 'ATIVA', emAndamento: false, temJogoPendente: true }), true)
assert.equal(encerradas[0]?.status, 'ENCERRADA')

console.log('proximo-jogo: ok')
