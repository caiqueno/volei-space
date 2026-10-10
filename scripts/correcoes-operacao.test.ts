import assert from 'node:assert/strict'
import { atletaRepetidoNaPapeleta, escalacaoParaJogo, papeletaCompleta } from '../src/lib/escalacao-inicial'
import { ladosInvertidosNoPonto, placarNaOrientacao } from '../src/lib/placar-orientacao'
import { resumirPontos, textoPontoSemJogador, textoResumoScout } from '../src/lib/ponto-sumula'
import { manterPaginaAberta } from '../src/lib/pagina-aberta'
import { destinoDepoisDoCodigo, rotuloArbitroResponsavel } from '../src/lib/arbitro-responsavel'
import { chavePorPosicao, cruzarGrupos, montarConfrontosAutomaticos, ranquearGrupo } from '../src/lib/chave-grupos'
import { numeroMvpDaLista } from '../src/lib/numero-camisa-partida'

assert.deepEqual(escalacaoParaJogo(null, ['1', '2', '3', '4', '5', '6'], true), ['', '', '', '', '', ''])
assert.deepEqual(escalacaoParaJogo(['', '', '', '', '', ''], ['7', '8', '9', '10', '11', '12'], false), ['', '', '', '', '', ''])
assert.equal(escalacaoParaJogo(['4', '5'], ['1'], false)[0], '4')
assert.equal(atletaRepetidoNaPapeleta(['4', '', '', '', '', ''], 2, '4'), true)
assert.equal(atletaRepetidoNaPapeleta(['4', '', '', '', '', ''], 0, '4'), false)
assert.equal(papeletaCompleta(['1', '2', '3', '4', '5', '6']), true)
assert.equal(papeletaCompleta(['1', '2', '3', '4', '5', '']), false)
assert.equal(papeletaCompleta(['1', '2', '3', '4', '5', '1']), false)

assert.equal(placarNaOrientacao('25 x 00', false), '25 x 00')
assert.equal(placarNaOrientacao('25 x 00', true), '00 x 25')
const eventos = [
  { text: 'ponto atual' },
  { text: 'Equipes inverteram os lados da quadra.' },
  { text: 'ponto anterior' },
]
assert.equal(ladosInvertidosNoPonto(eventos, 0, true), true)
assert.equal(ladosInvertidosNoPonto(eventos, 2, true), false)
assert.equal(placarNaOrientacao('25 x 00', ladosInvertidosNoPonto(eventos, 0, true)), '00 x 25')

const resumo = resumirPontos([
  { type: 'attack', text: 'Ataque' },
  { type: 'point', text: textoPontoSemJogador('TIME') },
  { type: 'ace', text: 'ACE' },
  { type: 'anotacao', text: 'tempo' },
])
assert.deepEqual(resumo, { atribuidos: 2, semAtleta: 1 })
assert.match(textoResumoScout(resumo), /2 ponto\(s\) atribuído\(s\) a atletas/)
assert.match(textoResumoScout(resumo), /1 sem atleta/)
assert.doesNotMatch(textoResumoScout({ atribuidos: 3, semAtleta: 0 }), /sem atleta/)

const aberta = [
  { id: 1, nome: 'grupo' },
  { id: 9, nome: 'final' },
]
const janela = [
  { id: 1, nome: 'grupo novo' },
  { id: 2, nome: 'grupo 2' },
]
assert.deepEqual(
  manterPaginaAberta(aberta, janela, true).map((item) => item.id),
  [1, 9, 2],
)
assert.equal(manterPaginaAberta(aberta, janela, true)[0].nome, 'grupo novo')
assert.deepEqual(manterPaginaAberta(aberta, [{ id: 30, nome: 'outro' }], false).map((item) => item.id), [30])
assert.deepEqual(manterPaginaAberta(aberta, [{ id: 1, nome: 'só o grupo' }], false).map((item) => item.id), [1])

assert.equal(rotuloArbitroResponsavel([null, ''], true), 'Árbitro do link')
assert.equal(rotuloArbitroResponsavel(['Mesa'], true), 'Mesa')
assert.equal(rotuloArbitroResponsavel([], false), 'Não registrado')
assert.equal(destinoDepoisDoCodigo({ id: 4, status: 'EM_ANDAMENTO', sumulaToken: 'abc' }, 'link'), '/sumula/abc/lancar')
assert.equal(destinoDepoisDoCodigo({ id: 4, status: 'AGENDADA', sumulaToken: 'abc' }, 'link'), '/arbitro/partida/link')

assert.deepEqual(chavePorPosicao([1, 2, 3, 4]), [
  { rodada: 1, equipeAId: 1, equipeBId: 4 },
  { rodada: 2, equipeAId: 2, equipeBId: 3 },
])
assert.deepEqual(cruzarGrupos([
  { id: 1, ordem: 1, classificados: [10, 11] },
  { id: 2, ordem: 2, classificados: [20, 21] },
]), [
  { rodada: 1, equipeAId: 10, equipeBId: 21 },
  { rodada: 2, equipeAId: 20, equipeBId: 11 },
])

const ordem = ranquearGrupo([1, 2], [
  { equipeAId: 1, equipeBId: 2, setsPorA: 2, setsPorB: 0, status: 'ENCERRADA', fase: 'GRUPOS', vencedorId: 1 },
  { equipeAId: 2, equipeBId: 1, setsPorA: 2, setsPorB: 1, status: 'ENCERRADA', fase: 'GRUPOS', vencedorId: 2 },
], 2)
assert.deepEqual(ordem, [1, 2])

const chave = montarConfrontosAutomaticos({
  grupos: [
    { id: 1, ordem: 1, classificados: [10, 11] },
    { id: 2, ordem: 2, classificados: [20, 21] },
  ],
  faseInicial: 'SEMIFINAL',
  rounds: [{ fase: 'SEMIFINAL', slots: 2 }, { fase: 'FINAL', slots: 1 }],
  disputaTerceiro: true,
  existentes: [],
  partidas: [],
})
assert.deepEqual(chave.map((jogo) => jogo.fase), ['SEMIFINAL', 'SEMIFINAL'])

const depois = montarConfrontosAutomaticos({
  grupos: [],
  faseInicial: 'SEMIFINAL',
  rounds: [{ fase: 'SEMIFINAL', slots: 2 }, { fase: 'FINAL', slots: 1 }],
  disputaTerceiro: true,
  existentes: [
    { fase: 'SEMIFINAL', rodada: 1 },
    { fase: 'SEMIFINAL', rodada: 2 },
  ],
  partidas: [
    { fase: 'SEMIFINAL', rodada: 1, status: 'ENCERRADA', equipeAId: 10, equipeBId: 21, setsPorA: 2, setsPorB: 0, vencedorId: 10 },
    { fase: 'SEMIFINAL', rodada: 2, status: 'ENCERRADA', equipeAId: 20, equipeBId: 11, setsPorA: 0, setsPorB: 2, vencedorId: 11 },
  ],
})
assert.deepEqual(depois, [
  { fase: 'FINAL', rodada: 1, equipeAId: 10, equipeBId: 11 },
  { fase: 'TERCEIRO_LUGAR', rodada: 1, equipeAId: 21, equipeBId: 20 },
])

assert.equal(numeroMvpDaLista('1', '21'), '21')

console.log('correcoes-operacao ok')
