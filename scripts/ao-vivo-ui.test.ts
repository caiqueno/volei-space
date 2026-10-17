/** Placar ao vivo público: normalização sem PII, polling com recuo, decisão de visão. */
import assert from 'node:assert/strict'
import { decidirVisao, normalizarPlacar, partidaFinalizada, rotuloStatus } from '../src/lib/ao-vivo-ui/placar'
import { aoVivoAtivo, devePausar, horaCurta, intervaloComRecuo, partidaIdValido, rotuloAtualizado } from '../src/lib/ao-vivo-ui/polling'

// Recuo: 3 s sem falhas, dobra a cada falha, teto 30 s.
assert.equal(intervaloComRecuo(0), 3000)
assert.equal(intervaloComRecuo(1), 6000)
assert.equal(intervaloComRecuo(2), 12000)
assert.equal(intervaloComRecuo(3), 24000)
assert.equal(intervaloComRecuo(4), 30000)
assert.equal(intervaloComRecuo(50), 30000)

// Pausa com aba oculta ou sem rede.
assert.equal(devePausar({ visivel: true, online: true }), false)
assert.equal(devePausar({ visivel: false, online: true }), true)
assert.equal(devePausar({ visivel: true, online: false }), true)

assert.equal(horaCurta(new Date(2026, 0, 1, 9, 5).getTime()), '09:05')
assert.equal(rotuloAtualizado(new Date(2026, 0, 1, 14, 5).getTime()), 'Atualizado às 14:05')
assert.match(rotuloAtualizado(null), /Aguardando/)

assert.equal(partidaIdValido('123'), 123)
assert.equal(partidaIdValido('0'), null)
assert.equal(partidaIdValido('12a'), null)
assert.equal(partidaIdValido('../x'), null)
assert.equal(partidaIdValido(undefined), null)
assert.equal(aoVivoAtivo('1'), true)
assert.equal(aoVivoAtivo('true'), false)
assert.equal(aoVivoAtivo(undefined), false)

// Normalização.
const corpo = {
  data: {
    partida: { id: 7, equipeA: 'Alfa', equipeB: 'Beta', status: 'em_andamento', setsA: 1, setsB: 0, setAtual: 2, pontosA: 12, pontosB: 9, sacador: 'A', cpf: '000', telefone: '99' },
    sets: [
      { numero: 2, a: 12, b: 9 },
      { numero: 1, a: 25, b: 20, jogador: 'Fulano' },
    ],
    atualizadoEm: '2026-01-01T10:00:00Z',
    atletas: [{ nome: 'Fulano', documento: '1' }],
  },
}
const p = normalizarPlacar(corpo)!
assert.equal(p.status, 'EM_ANDAMENTO')
assert.equal(p.pontosA, 12)
assert.equal(p.sacador, 'A')
assert.deepEqual(p.sets, [{ numero: 1, a: 25, b: 20 }, { numero: 2, a: 12, b: 9 }], 'sets em ordem e só campos conhecidos')
const serializado = JSON.stringify(p)
for (const proibido of ['cpf', 'telefone', 'Fulano', 'documento']) assert.ok(!serializado.includes(proibido), `sem PII: ${proibido}`)

assert.equal(normalizarPlacar(null), null)
assert.equal(normalizarPlacar({ data: {} }), null)
assert.equal(normalizarPlacar({ data: { partida: { id: 'x' } } }), null)
assert.equal(normalizarPlacar({ data: { partida: { id: 1, pontosA: -5, pontosB: 'lixo', sacador: 'Alfa', equipeA: 'Alfa' } } })!.pontosA, 0)
assert.equal(normalizarPlacar({ data: { partida: { id: 1, equipeA: 'Alfa', sacador: 'Alfa' } } })!.sacador, 'A', 'sacador pelo nome da equipe')
assert.equal(normalizarPlacar({ data: { partida: { id: 1, sacador: 'Zeta' } } })!.sacador, null)

assert.equal(partidaFinalizada('ENCERRADA'), true)
assert.equal(partidaFinalizada('WO'), true)
assert.equal(partidaFinalizada('EM_ANDAMENTO'), false)
assert.equal(rotuloStatus('EM_ANDAMENTO'), 'Ao vivo')

// Visão: 404 manda; com placar antigo e falha de rede mantém o placar; sem dados e com falha mostra erro.
assert.equal(decidirVisao({ temPlacar: false, naoEncontrada: false, falhou: false, carregou: false }), 'carregando')
assert.equal(decidirVisao({ temPlacar: false, naoEncontrada: true, falhou: false, carregou: true }), 'nao-encontrada')
assert.equal(decidirVisao({ temPlacar: true, naoEncontrada: false, falhou: true, carregou: true }), 'placar')
assert.equal(decidirVisao({ temPlacar: false, naoEncontrada: false, falhou: true, carregou: true }), 'erro')

console.log('ao-vivo-ui: ok')
