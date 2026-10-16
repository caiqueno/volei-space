import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectarSentido, emOrdemCronologica } from '../src/lib/sumula-ui/ordem'
import {
  ehPontoDePenalidade,
  marcadorSancao,
  reconstruirEstadoEquipe,
  semMarcadores,
  type EventoDoSet,
} from '../src/lib/sumula-ui/estado'
import { perfilDaSumula } from '../src/lib/sumula-ui/perfil'
import {
  anexarOverride,
  contarOverrides,
  ehNaoConfirmado,
  justificativaValida,
  lerOverride,
  limparJustificativa,
  marcadorOverride,
} from '../src/lib/sumula-ui/override'
import {
  anotacoesSemEventoCorrespondente,
  semAnotacoesDosEventos,
  semEventos,
  trocasPosterioresAosRemovidos,
  ultimaSancaoSemPonto,
  ultimaTrocaDoSet,
} from '../src/lib/sumula-ui/desfazer'
import { avaliarCartao, resolverCartao } from '../src/lib/sumula-ui/sancao'
import { avaliarTempo } from '../src/lib/sumula-ui/tempos'
import { montarSumulaImpressa } from '../src/lib/sumula-impressa/montar'
import type { RegistroSumula } from '../src/lib/sumula-impressa/tipos'

/* ---------------- M4: ordem explícita, nas duas direções ---------------- */

type Ev = { id: number; set: number; tipo: string; nome: string }
const cronologica: Ev[] = [
  { id: 1, set: 1, tipo: 'set_start', nome: 'inicio1' },
  { id: 2, set: 1, tipo: 'timeout', nome: 'tempo1' },
  { id: 3, set: 1, tipo: 'substitution', nome: 'troca1' },
  { id: 4, set: 1, tipo: 'timeout', nome: 'tempo2' },
  { id: 5, set: 1, tipo: 'set_end', nome: 'fim1' },
  { id: 6, set: 2, tipo: 'set_start', nome: 'inicio2' },
]
const gravadaDoMaisNovo = [...cronologica].reverse().map((e, i) => ({ ...e, id: i + 1 }))

assert.deepEqual(emOrdemCronologica(cronologica, 'auto').map((e) => e.nome), cronologica.map((e) => e.nome))
assert.deepEqual(emOrdemCronologica(gravadaDoMaisNovo, 'auto').map((e) => e.nome), cronologica.map((e) => e.nome))
// sentido declarado
assert.deepEqual(emOrdemCronologica(gravadaDoMaisNovo, 'novo-primeiro').map((e) => e.nome), cronologica.map((e) => e.nome))
assert.deepEqual(emOrdemCronologica(cronologica, 'antigo-primeiro').map((e) => e.nome), cronologica.map((e) => e.nome))
// a entrada não é alterada
assert.equal(gravadaDoMaisNovo[0].nome, 'inicio2')
// ids embaralhados no array: o id crescente é a ordem de gravação
assert.deepEqual(emOrdemCronologica([...cronologica].reverse(), 'antigo-primeiro').map((e) => e.nome), cronologica.map((e) => e.nome))
// âncora dentro do set quando só há um set
const umSet = [
  { id: 1, set: 1, tipo: 'set_end' },
  { id: 2, set: 1, tipo: 'timeout' },
  { id: 3, set: 1, tipo: 'set_start' },
]
assert.equal(detectarSentido(umSet), 'novo-primeiro')
assert.equal(detectarSentido([...umSet].reverse().map((e, i) => ({ ...e, id: i + 1 }))), 'antigo-primeiro')
// sem âncora: formato gravado pela tela (mais novo primeiro)
assert.equal(detectarSentido([{ id: 1, set: 1, tipo: 'timeout' }, { id: 2, set: 1, tipo: 'timeout' }]), 'novo-primeiro')
assert.deepEqual(emOrdemCronologica([], 'auto'), [])
// ids de texto da tela (sem número) usam a posição
const daTela = [{ id: 'ev-9-0.5', nome: 'b' }, { id: 'ev-5-0.1', nome: 'a' }]
assert.deepEqual(emOrdemCronologica(daTela, 'novo-primeiro').map((e) => e.nome), ['a', 'b'])

// replay: o mesmo resultado qualquer que seja a ordem em que a lista chegou
const perfil = perfilDaSumula(undefined)
const elenco = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13]
const eventosCron: EventoDoSet[] = [
  { type: 'substitution', text: 'Substituição X: sai #1 A, entra #7 B.', teamId: 'teamA', set: 1 },
  { type: 'point', text: '+1', teamId: 'teamA', set: 1 },
  { type: 'substitution', text: 'Substituição X: sai #7 B, entra #1 A.', teamId: 'teamA', set: 1 },
]
const comIds = eventosCron.map((e, i) => ({ ...e, id: i + 1, tipo: e.type }))
function replay(lista: EventoDoSet[]) {
  return reconstruirEstadoEquipe({
    elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil, eventosDoSet: lista,
    idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
  })
}
const esperado = replay(eventosCron)
assert.deepEqual(esperado.emQuadra, [1, 2, 3, 4, 5, 6])
const invertida = [...comIds].reverse().map((e, i) => ({ ...e, id: i + 1 }))
assert.deepEqual(replay(emOrdemCronologica(invertida, 'novo-primeiro')).emQuadra, esperado.emQuadra)
assert.deepEqual(replay(emOrdemCronologica(comIds, 'antigo-primeiro')).emQuadra, esperado.emQuadra)
// premissa errada (a lista invertida usada sem ordenar) muda o resultado: é o defeito M4
assert.notDeepEqual(replay(invertida).emQuadra, esperado.emQuadra)

// impressa: fixture gravada do mais novo ao mais antigo sai igual à cronológica
const jog = (id: number, nome: string, numero: number) => ({ id, nome, numero, posicao: null })
const A = [jog(1, 'Ana', 1), jog(2, 'Bia', 2), jog(3, 'Cris', 3), jog(4, 'Dani', 4), jog(5, 'Eva', 5), jog(6, 'Fa', 6)]
const B = [jog(11, 'Lia', 1), jog(12, 'Mel', 2), jog(13, 'Nina', 3), jog(14, 'Ola', 4), jog(15, 'Pri', 5), jog(16, 'Quel', 6)]
const ocorrenciasCron = [
  { id: 1, tipo: 'set_start', set: 1, descricao: '14:00 | 0-0 | Papeleta do set 1 confirmada. [[ROT:1:teamA:1,2,3,4,5,6:1,2,3,4,5,6]]' },
  { id: 2, tipo: 'timeout', set: 1, descricao: '14:05 | 3-2 | Tempo solicitado por Alfa (1/2 no set 1).' },
  { id: 3, tipo: 'substitution', set: 1, descricao: '14:08 | 5-4 | Substituição Beta: sai #6 Quel, entra #8 Rô.' },
  { id: 4, tipo: 'timeout', set: 1, descricao: '14:10 | 8-5 | Tempo solicitado por Beta (1/2 no set 1).' },
  { id: 5, tipo: 'substitution', set: 1, descricao: '14:12 | 10-6 | Substituição Alfa: sai #1 Ana, entra #7 Gi.' },
  { id: 6, tipo: 'set_end', set: 1, descricao: '14:25 | 25-18 | Set 1 encerrado.' },
]
function registro(ocorrencias: typeof ocorrenciasCron): RegistroSumula {
  return {
    id: 1, status: 'ENCERRADA', setsPorA: 1, setsPorB: 0, vencedorId: 100,
    equipeA: { id: 100, nome: 'Alfa', jogadores: A }, equipeB: { id: 200, nome: 'Beta', jogadores: B },
    sets: [{ numero: 1, pontosA: 25, pontosB: 18 }], presencas: [], ocorrencias,
  }
}
const gravadaTela = [...ocorrenciasCron].reverse().map((o, i) => ({ ...o, id: i + 1 }))
const mCron = montarSumulaImpressa(registro(ocorrenciasCron))!
const mTela = montarSumulaImpressa(registro(gravadaTela))!
const textos = (m: typeof mCron, campo: 'tempos' | 'substituicoes') => m.sets[0][campo].map((e) => e.texto)
assert.deepEqual(textos(mTela, 'tempos'), textos(mCron, 'tempos'))
assert.deepEqual(textos(mTela, 'substituicoes'), textos(mCron, 'substituicoes'))
assert.match(textos(mCron, 'tempos')[0], /Alfa/)
assert.match(textos(mCron, 'substituicoes')[0], /Beta/)
assert.equal(mTela.sets[0].inicio, '14:00')
assert.equal(mTela.sets[0].fim, '14:25')

/* ---------------- B7: ponto de penalidade não é rally ---------------- */

assert.equal(ehPontoDePenalidade('Ponto e saque para Alfa por penalidade aplicada a #3.'), true)
assert.equal(ehPontoDePenalidade('+1 Ponto de Ataque — Ana. Ataque para Alfa: #1 Ana.'), false)
const libero: EventoDoSet = { type: 'libero_exchange', text: 'Troca de líbero Alfa: sai #1 Ana, entra #13 Lib.', teamId: 'teamA', set: 1 }
const aposPenalidade = replay([libero, { type: 'point', text: 'Ponto e saque para Beta por penalidade aplicada a #3.', teamId: 'teamB', set: 1 }])
assert.equal(aposPenalidade.rallyConcluidoDesdeTrocaLibero, false)
const aposRally = replay([libero, { type: 'point', text: '+1 — Sem jogador. Ponto para Beta sem jogador atribuído.', teamId: 'teamB', set: 1 }])
assert.equal(aposRally.rallyConcluidoDesdeTrocaLibero, true)

/* ---------------- M6/M2: override ---------------- */

assert.equal(justificativaValida('curta'), false)
assert.equal(justificativaValida('   x   '), false)
assert.equal(justificativaValida('Árbitro confirmou em quadra'), true)
assert.equal(limparJustificativa('a [[SAN:A]] | b #3\nlinha'), 'a SAN:A b 3 linha')
assert.equal(marcadorOverride({ codigo: 'RG-SUB-001', justificativa: 'curta' }), '')
const marcado = anexarOverride('Substituição Alfa: sai #1 Ana, entra #7 Gi.', { codigo: 'RG-SUB-001', justificativa: 'Regra do campeonato permite 8 trocas' })
assert.deepEqual(lerOverride(marcado), { codigo: 'RG-SUB-001', justificativa: 'Regra do campeonato permite 8 trocas' })
assert.ok(!semMarcadores(marcado).includes('[['))
assert.match(semMarcadores(marcado), /Decisão do árbitro \(fora da regra RG-SUB-001\)/)
assert.equal(anexarOverride('x', { codigo: 'RG-SUB-001', justificativa: 'curta' }), 'x') // sem justificativa não marca
assert.equal(contarOverrides([marcado, 'texto comum', null]), 1)
// o marcador não confunde o replay das trocas
const comOvr = replay([{ type: 'substitution', text: marcado, teamId: 'teamA', set: 1 }])
assert.deepEqual(comOvr.emQuadra, [7, 2, 3, 4, 5, 6])
// itens [M] são explicitamente não confirmados; os demais não
assert.equal(ehNaoConfirmado('RG-SAN-001'), true)
assert.equal(ehNaoConfirmado('RG-SAN-002'), false)

// tempo acima do limite: o bloqueio existe e o fluxo da tela só segue com a decisão (a tela chama anexarOverride)
const tempo = avaliarTempo(2, 2, 'Alfa')
assert.equal(tempo.ok, false)

// cartão: primeira conduta menor + "Cartão amarelo" tocado => o motor calcula verbal; a tela NÃO troca em silêncio
const pedidoMenor = { equipe: 'A' as const, membro: 'J:3', categoria: 'MENOR' as const, set: 1 }
const avaliadoMenor = avaliarCartao([], pedidoMenor, 'Cartão amarelo')
assert.equal(avaliadoMenor.ok, true)
if (avaliadoMenor.ok) {
  assert.equal(avaliadoMenor.divergencia?.tocado, 'Cartão amarelo')
  assert.equal(avaliadoMenor.divergencia?.rotuloCalculado, 'Advertência verbal')
  assert.equal(avaliadoMenor.divergencia?.naoConfirmado, true)
  assert.equal(avaliadoMenor.naoConfirmado, true)
}
const semEscolha = resolverCartao([], pedidoMenor, 'Cartão amarelo')
assert.equal(semEscolha.ok, false)
if (!semEscolha.ok) {
  assert.equal(semEscolha.calculado, 'Advertência verbal')
  assert.equal(semEscolha.caixa.codigo, 'RG-SAN-001')
  assert.match(semEscolha.caixa.mensagem, /Nada foi registrado/)
}
const justo = resolverCartao([], pedidoMenor, 'Cartão amarelo', { decisao: { codigo: 'x', justificativa: 'curta' } })
assert.equal(justo.ok, false) // justificativa curta não libera
const aceitou = resolverCartao([], pedidoMenor, 'Cartão amarelo', { aceitaCalculado: true })
assert.equal(aceitou.ok, true)
if (aceitou.ok) {
  assert.equal(aceitou.registro.sancao, 'ADVERTENCIA_VERBAL')
  assert.equal(aceitou.decisao, null)
}
const doArbitro = resolverCartao([], pedidoMenor, 'Cartão amarelo', { decisao: { codigo: 'x', justificativa: 'Árbitro mandou amarelo direto' } })
assert.equal(doArbitro.ok, true)
if (doArbitro.ok) {
  assert.equal(doArbitro.registro.sancao, 'AMARELO') // o cartão que ele tocou
  assert.equal(doArbitro.avaliada.pontoParaAdversario, false)
  assert.equal(doArbitro.decisao?.codigo, 'RG-SAN-001')
  assert.match(marcadorSancao('A', doArbitro.registro), /\[\[SAN:A:J\.3:MENOR:AMARELO:1\]\]/)
}
// sem divergência (vermelho tocado, penalidade calculada): segue direto, sem pedir nada
const grosseira = resolverCartao([], { ...pedidoMenor, categoria: 'GROSSEIRA' }, 'Cartão vermelho')
assert.equal(grosseira.ok, true)
// bloqueio do motor (RG-SAN-007: expulso no set) só passa com decisão justificada
const historicoExpulso = [{ equipe: 'A' as const, membro: 'J:3', categoria: 'OFENSIVA' as const, sancao: 'EXPULSAO' as const, set: 1 }]
const bloqueado = resolverCartao(historicoExpulso, pedidoMenor, 'Cartão amarelo')
assert.equal(bloqueado.ok, false)
if (!bloqueado.ok) assert.equal(bloqueado.caixa.codigo, 'RG-SAN-007')
const liberado = resolverCartao(historicoExpulso, pedidoMenor, 'Cartão amarelo', { decisao: { codigo: 'x', justificativa: 'Árbitro principal confirmou' } })
assert.equal(liberado.ok, true)
if (liberado.ok) assert.equal(liberado.decisao?.codigo, 'RG-SAN-007')

// impressa: o registro por decisão do árbitro aparece marcado e listado à parte
const ocorrenciaOverride = { id: 7, tipo: 'substitution', set: 1, descricao: `14:30 | 12-9 | ${marcado}` }
const mOvr = montarSumulaImpressa(registro([...ocorrenciasCron, ocorrenciaOverride]))!
assert.equal(mOvr.decisoesDoArbitro.length, 1)
assert.match(mOvr.decisoesDoArbitro[0].decisaoArbitro ?? '', /RG-SUB-001: Regra do campeonato/)
assert.equal(mOvr.sets[0].substituicoes.some((e) => e.decisaoArbitro), true)
assert.equal(mCron.decisoesDoArbitro.length, 0)
// sanção gravada duas vezes (nota sem marcador + evento com marcador) sai uma vez; observação idem
const registroSan = registro([
  { id: 1, tipo: 'CARTAO_AMARELO', set: 1, descricao: '14:15 | 12-6 | [Cartão amarelo] Beta - Ola: reclamação' },
  { id: 2, tipo: 'CARTAO_AMARELO', set: 1, descricao: '14:15 | 12-6 | [Cartão amarelo] Beta - Ola: reclamação [[SAN:B:J.14:MENOR:AMARELO:1]]' },
  { id: 3, tipo: 'OBSERVACAO', set: 1, descricao: '14:17 | 12-6 | Bola trocada.' },
  { id: 4, tipo: 'anotacao', set: 1, descricao: '14:17 | 12-6 | Bola trocada.' },
])
const mSan = montarSumulaImpressa(registroSan)!
assert.equal(mSan.sancoes.length, 1)
assert.equal(mSan.observacoes.length, 1)

/* ---------------- M5: desfazer alcança sanção e troca ---------------- */

type Reg = { id: string; type: string; text: string; set: number; teamId?: string }
// do mais novo ao mais antigo, como a tela guarda
const log: Reg[] = [
  { id: 'e7', type: 'substitution', text: 'Substituição Alfa: sai #2 B, entra #8 H.', set: 1, teamId: 'teamA' },
  { id: 'e6', type: 'point', text: '+1 — Sem jogador. Ponto para Beta sem jogador atribuído.', set: 1, teamId: 'teamB' },
  { id: 'e5', type: 'anotacao', text: `[Cartão amarelo] Alfa - #3: x ${marcadorSancao('A', { equipe: 'A', membro: 'J:3', categoria: 'MENOR', sancao: 'AMARELO', set: 1 })}`, set: 1, teamId: 'teamA' },
  { id: 'e4', type: 'substitution', text: 'Substituição Alfa: sai #1 A, entra #7 G.', set: 1, teamId: 'teamA' },
  { id: 'e3', type: 'point', text: '+1 — Sem jogador. Ponto para Alfa sem jogador atribuído.', set: 1, teamId: 'teamA' },
  { id: 'e2', type: 'anotacao', text: `[Cartão vermelho] Beta - #4: y ${marcadorSancao('B', { equipe: 'B', membro: 'J:4', categoria: 'GROSSEIRA', sancao: 'PENALIDADE', set: 1 })}`, set: 1, teamId: 'teamB' },
  { id: 'e1', type: 'set_start', text: 'Papeleta', set: 1 },
]
assert.equal(ultimaSancaoSemPonto(log, 1)?.id, 'e5') // a penalidade (e2) dá ponto: sai pelo desfazer de ponto
assert.equal(ultimaSancaoSemPonto(log.filter((e) => e.id !== 'e5'), 1), null)
assert.equal(ultimaSancaoSemPonto(log, 2), null)
assert.equal(ultimaTrocaDoSet(log, 1)?.id, 'e7')

// desfazer o ponto e3 (antes das trocas e4 e e7) leva as trocas junto; a sanção e5 permanece (separada)
const dependentes = trocasPosterioresAosRemovidos(log, ['e3'])
assert.deepEqual(dependentes.map((e) => e.id).sort(), ['e4', 'e7'])
// desfazer o último ponto (e6): só a troca e7, que veio depois
assert.deepEqual(trocasPosterioresAosRemovidos(log, ['e6']).map((e) => e.id), ['e7'])
// troca anterior ao ponto removido fica
assert.deepEqual(trocasPosterioresAosRemovidos(log, ['e7']), [])
assert.deepEqual(trocasPosterioresAosRemovidos(log, ['inexistente']), [])
assert.deepEqual(semEventos(log, ['e3', 'e4']).map((e) => e.id), ['e7', 'e6', 'e5', 'e2', 'e1'])

// itens de anotacoes ligados a eventos removidos saem junto; os sem vínculo ficam
const notas = [{ id: 'n1', eventoId: 'e2' }, { id: 'n2', eventoId: 'e5' }, { id: 'n3' }]
assert.deepEqual(semAnotacoesDosEventos(notas, ['e2', 'e3']).map((n) => n.id), ['n2', 'n3'])
// no PUT, a nota que já existe como evento não segue duas vezes
assert.deepEqual(anotacoesSemEventoCorrespondente(notas, log).map((n) => n.id), ['n3'])
assert.deepEqual(anotacoesSemEventoCorrespondente(notas, log.filter((e) => e.id !== 'e2')).map((n) => n.id), ['n1', 'n3'])

/* ---------------- fiação na tela (texto-fonte) ---------------- */

const pagina = readFileSync('src/app/sumula/[token]/lancar/page.tsx', 'utf8')
assert.ok(pagina.includes("emOrdemCronologica(events, 'novo-primeiro')"), 'replay usa a ordenação compartilhada')
assert.ok(!/\[\.\.\.events\]\.reverse\(\)/.test(pagina), 'sem reverse() implícito dos eventos')
assert.ok(pagina.includes('trocasPosterioresAosRemovidos'), 'desfazer de ponto leva as trocas posteriores')
assert.ok(pagina.includes('semAnotacoesDosEventos'), 'desfazer remove os itens de anotacoes')
assert.ok(pagina.includes('anotacoesSemEventoCorrespondente'), 'o PUT não duplica notas')
assert.ok(pagina.includes('PainelCorrecoes'), 'painel de correções e impressão')
assert.ok(pagina.includes('resolverCartao'), 'cartão passa pela confirmação do árbitro')
const painel = readFileSync('src/components/sumula/PainelCorrecoes.tsx', 'utf8')
assert.ok(painel.includes('/imprimir') === false && painel.includes('hrefImpressao'), 'o link vem de quem usa o painel')
assert.ok(pagina.includes('/imprimir'), 'a tela da súmula liga a impressão')
const caixa = readFileSync('src/components/sumula/CaixaRegra.tsx', 'utf8')
assert.ok(caixa.includes('ROTULO_OVERRIDE') && caixa.includes('Justificativa do árbitro (obrigatória)'))
const registroPagina = readFileSync('src/app/sumula/[token]/page.tsx', 'utf8')
assert.ok(registroPagina.includes('/imprimir') && registroPagina.includes('emOrdemCronologica'))
const modal = readFileSync('src/components/sumula/ModalSubstituicao.tsx', 'utf8')
assert.ok(modal.includes('onOverride'), 'bloqueio de troca tem saída')

console.log('sumula-r5-qa ok')
