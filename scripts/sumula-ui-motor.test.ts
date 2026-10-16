import assert from 'node:assert/strict'
import { criarEstadoEquipe } from '../src/lib/regras-volei'
import { acaoCorretiva, caixaDeBloqueio } from '../src/lib/sumula-ui/explicacao'
import { perfilDaSumula, LIMITE_PADRAO_DA_TELA } from '../src/lib/sumula-ui/perfil'
import {
  avaliarExcepcional,
  avaliarSubstituicao,
  avaliarTrocaLibero,
  avaliarRedesignacao,
  candidatosDoModo,
  contadorDoModo,
  resumoDeTrocas,
} from '../src/lib/sumula-ui/avaliacao'
import {
  comFormacaoAtual,
  formacaoParaMotor,
  historicoDeSancoes,
  lerSancao,
  marcadorSancao,
  reconstruirEstadoEquipe,
  semMarcadores,
  type EventoDoSet,
} from '../src/lib/sumula-ui/estado'
import { avaliarCartao, categoriaPadraoDoTipo, descreverEfeito, tipoDaNota } from '../src/lib/sumula-ui/sancao'
import { avaliarTempo, limiteDeTemposDaTela, textoTempo } from '../src/lib/sumula-ui/tempos'

// --- perfil
assert.equal(perfilDaSumula(undefined).limiteSubstituicoesPorSet, LIMITE_PADRAO_DA_TELA)
assert.equal(perfilDaSumula(undefined).id, 'AMADOR')
assert.equal(perfilDaSumula(6).id, 'FIVB_CBV')
assert.equal(perfilDaSumula(6).limiteSubstituicoesPorSet, 6)
assert.equal(perfilDaSumula(0).limiteSubstituicoesPorSet, 8)

// --- formação: ordem da tela [P4,P3,P2,P5,P6,P1] -> motor [I..VI]
const ids = (n: string) => Number(n)
assert.deepEqual(formacaoParaMotor(['4', '3', '2', '5', '6', '1'], ids), [1, 2, 3, 4, 5, 6])
assert.equal(formacaoParaMotor(['4', '3', '', '5', '6', '1'], ids), null)
assert.equal(formacaoParaMotor(['4', '4', '2', '5', '6', '1'], ids), null)

// elenco 1..6 em quadra, 7..12 reservas, 13 líbero
const elenco = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
const base = () => criarEstadoEquipe({ elenco, liberos: [13], formacaoInicial: [1, 2, 3, 4, 5, 6] })
const perfil = perfilDaSumula(undefined)

// --- substituição: padrão 8, aviso acima de 6 com código, contador
let estado = base()
const ok1 = avaliarSubstituicao(estado, { sai: 1, entra: 7 }, perfil)
assert.equal(ok1.ok, true)
assert.equal(contadorDoModo('regular', estado, perfil), 'Troca 1 de 8')

const seis = { ...estado, regulares: 6 }
const aviso7 = avaliarSubstituicao(seis, { sai: 1, entra: 7 }, perfil)
assert.equal(aviso7.ok, true)
if (aviso7.ok) {
  assert.equal(aviso7.avisos[0].codigo, 'RG-SUB-001')
  assert.match(aviso7.avisos[0].mensagem, /FIVB/)
}
const oito = avaliarSubstituicao({ ...estado, regulares: 8 }, { sai: 1, entra: 7 }, perfil)
assert.equal(oito.ok, false)
if (!oito.ok) {
  assert.equal(oito.caixa.codigo, 'RG-SUB-001')
  assert.equal(oito.caixa.tipo, 'bloqueio')
  assert.ok(oito.caixa.acao.length > 10)
}
// perfil FIVB/CBV: limite 6 bloqueia a 7a
const fivb = perfilDaSumula(6)
assert.equal(avaliarSubstituicao({ ...estado, regulares: 6 }, { sai: 1, entra: 7 }, fivb).ok, false)

// pedido repetido na mesma interrupção: aviso RG-SUB-007, não bloqueio
const pedido = { ...estado, pedidoNaInterrupcao: true }
const r7 = avaliarSubstituicao(pedido, { sai: 2, entra: 8 }, perfil)
assert.equal(r7.ok, true)
if (r7.ok) assert.ok(r7.avisos.some((a) => a.codigo === 'RG-SUB-007'))

// reserva não pode sair para terceiro (RG-SUB-004) e contador usa o motor
const depoisDe1 = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil,
  eventosDoSet: [{ type: 'substitution', text: 'Substituição X: sai #1 A, entra #7 B.', teamId: 'teamA', set: 1 }],
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
})
assert.equal(depoisDe1.regulares, 1)
assert.deepEqual(depoisDe1.emQuadra, [7, 2, 3, 4, 5, 6])
const terceiro = avaliarSubstituicao(depoisDe1, { sai: 7, entra: 8 }, perfil)
assert.equal(terceiro.ok, false)
if (!terceiro.ok) assert.equal(terceiro.caixa.codigo, 'RG-SUB-004')
assert.equal(avaliarSubstituicao(depoisDe1, { sai: 7, entra: 1 }, perfil).ok, true)

// --- excepcional: só sem substituição regular legal; contador próprio; lesionado não volta
const semRegular = { ...estado, regulares: 8 }
const exc = avaliarExcepcional(semRegular, { sai: 1, entra: 7 }, 'LESAO', perfil)
assert.equal(exc.ok, true)
const excBloq = avaliarExcepcional(estado, { sai: 1, entra: 7 }, 'LESAO', perfil)
assert.equal(excBloq.ok, false)
if (!excBloq.ok) assert.equal(excBloq.caixa.codigo, 'RG-SUB-011')
const lesionado = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil,
  eventosDoSet: [
    { type: 'substitution', text: 'sai #1 a, entra #7 b', teamId: 'teamA', set: 1 },
    { type: 'injury_substitution', text: 'Substituição excepcional: sai #2 a, entra #8 b. [[EXC:LESAO]]', teamId: 'teamA', set: 1 },
  ],
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
})
assert.equal(lesionado.regulares, 1)
assert.equal(lesionado.excepcionais, 1)
assert.deepEqual(lesionado.semRetorno, [2])
assert.match(contadorDoModo('excepcional', lesionado, perfil), /excepcional 2/)
const volta = avaliarSubstituicao({ ...lesionado, regulares: 0 }, { sai: 8, entra: 2 }, perfil)
assert.equal(volta.ok, false)
if (!volta.ok) assert.equal(volta.caixa.codigo, 'RG-SUB-011')

// --- líbero: opcional (sem líbero a lista de líbero fica vazia), fundo de quadra, rally, não conta como substituição
const semLibero = criarEstadoEquipe({ elenco: [1, 2, 3, 4, 5, 6, 7], formacaoInicial: [1, 2, 3, 4, 5, 6] })
assert.deepEqual(candidatosDoModo('libero', semLibero, 1), [])
assert.deepEqual(candidatosDoModo('libero', base(), 1), [13])
assert.ok(!candidatosDoModo('regular', base(), 1).includes(13))
// posição I (índice 0) = jogador 1: fundo -> ok. posição II (índice 1) = jogador 2: frente -> RG-LIB-003
assert.equal(avaliarTrocaLibero(base(), { sai: 1, entra: 13 }).ok, true)
const frente = avaliarTrocaLibero(base(), { sai: 2, entra: 13 })
assert.equal(frente.ok, false)
if (!frente.ok) assert.equal(frente.caixa.codigo, 'RG-LIB-003')
// rally entre trocas
const comLibero = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil,
  eventosDoSet: [{ type: 'libero_exchange', text: 'Troca de líbero: sai #1 a, entra #13 b.', teamId: 'teamA', set: 1 }],
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
})
assert.equal(comLibero.regulares, 0)
assert.equal(comLibero.substituidoPorLibero, 1)
const semRally = avaliarTrocaLibero(comLibero, { sai: 13, entra: 1 })
assert.equal(semRally.ok, false)
if (!semRally.ok) assert.equal(semRally.caixa.codigo, 'RG-LIB-005')
const comRally = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil,
  eventosDoSet: [
    { type: 'libero_exchange', text: 'sai #1 a, entra #13 b', teamId: 'teamA', set: 1 },
    { type: 'point', text: '+1', teamId: 'teamB', set: 1 },
  ],
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
})
assert.equal(avaliarTrocaLibero(comRally, { sai: 13, entra: 1 }).ok, true)
const outroRegular = avaliarTrocaLibero(comRally, { sai: 13, entra: 7 })
assert.equal(outroRegular.ok, false)
if (!outroRegular.ok) assert.equal(outroRegular.caixa.codigo, 'RG-LIB-006')
assert.deepEqual(resumoDeTrocas(['substitution', 'libero_exchange', 'libero_exchange', 'injury_substitution']), { substituicoes: 1, excepcionais: 1, trocasDeLibero: 2 })

// redesignação: só se não houver outro líbero capaz
assert.equal(avaliarRedesignacao(base(), 13, 12).ok, true)
const doisLiberos = criarEstadoEquipe({ elenco: [...elenco, 14], liberos: [13, 14], formacaoInicial: [1, 2, 3, 4, 5, 6] })
const redBloq = avaliarRedesignacao(doisLiberos, 13, 12)
assert.equal(redBloq.ok, false)
if (!redBloq.ok) assert.equal(redBloq.caixa.codigo, 'RG-LIB-012')

// formação atual substitui emQuadra
assert.deepEqual(comFormacaoAtual(base(), [6, 1, 2, 3, 4, 5]).emQuadra, [6, 1, 2, 3, 4, 5])
assert.deepEqual(comFormacaoAtual(base(), null).emQuadra, [1, 2, 3, 4, 5, 6])

// --- sanções
const A = 'A' as const
const pedidoG = (membro: string, categoria: 'GROSSEIRA' | 'OFENSIVA' | 'MENOR' | 'ATRASO' | 'AGRESSAO' = 'GROSSEIRA') => ({ equipe: A, membro, categoria, set: 1 })
const g1 = avaliarCartao([], pedidoG('J:7'))
assert.equal(g1.ok, true)
if (g1.ok) {
  assert.equal(g1.avaliada.sancao, 'PENALIDADE')
  assert.equal(g1.avaliada.pontoParaAdversario, true)
  assert.equal(g1.avaliada.saqueParaAdversario, true)
  assert.match(descreverEfeito(g1.avaliada, 'Time B'), /Ponto e saque para Time B/)
  assert.equal(tipoDaNota(g1.avaliada.sancao), 'Cartão vermelho')
  const marcador = marcadorSancao('A', g1.registro)
  assert.deepEqual(lerSancao(`nota${marcador}`), g1.registro)
  assert.equal(semMarcadores(`nota${marcador} [[ROT:1:teamA:1:2]]`), 'nota')
  const g2 = avaliarCartao([g1.registro], pedidoG('J:7'))
  assert.equal(g2.ok && g2.avaliada.sancao, 'EXPULSAO')
  if (g2.ok) {
    assert.equal(g2.avaliada.pontoParaAdversario, false)
    assert.equal(g2.avaliada.exigeSubstituicaoSeEmQuadra, true)
    const g3 = avaliarCartao([g1.registro, g2.registro], pedidoG('J:7'))
    assert.equal(g3.ok, false)
    if (!g3.ok) assert.equal(g3.caixa.codigo, 'RG-SAN-007')
  }
}
// outro membro começa do zero; ofensiva = expulsão direta; agressão = desqualificação
const o1 = avaliarCartao([], pedidoG('J:8', 'OFENSIVA'))
assert.equal(o1.ok && o1.avaliada.sancao, 'EXPULSAO')
const ag = avaliarCartao([], pedidoG('J:9', 'AGRESSAO'))
assert.equal(ag.ok && ag.avaliada.sancao, 'DESQUALIFICACAO')
// menor: 1ª é advertência verbal, sem ponto
const m1 = avaliarCartao([], pedidoG('J:7', 'MENOR'))
assert.equal(m1.ok && m1.avaliada.pontoParaAdversario, false)
// atraso é da equipe: 1º advertência, 2º penalidade com ponto e saque
const at1 = avaliarCartao([], pedidoG('EQUIPE', 'ATRASO'))
assert.equal(at1.ok && at1.avaliada.sancao, 'ADVERTENCIA_ATRASO')
if (at1.ok) {
  const at2 = avaliarCartao([at1.registro], pedidoG('EQUIPE', 'ATRASO'))
  assert.equal(at2.ok && at2.avaliada.sancao, 'PENALIDADE_ATRASO')
  assert.equal(at2.ok && at2.avaliada.pontoParaAdversario, true)
}
assert.equal(categoriaPadraoDoTipo('Cartão vermelho'), 'GROSSEIRA')
assert.equal(categoriaPadraoDoTipo('Cartão amarelo'), 'MENOR')
assert.equal(categoriaPadraoDoTipo('Atraso'), 'ATRASO')
assert.equal(categoriaPadraoDoTipo('Observação'), null)

// expulso não volta: o replay marca o expulso e a substituição para ele entrar é bloqueada
const eventos: EventoDoSet[] = [
  { type: 'anotacao', text: `[Cartão vermelho] ... ${marcadorSancao('A', { equipe: 'A', membro: 'J:7', categoria: 'GROSSEIRA', sancao: 'EXPULSAO', set: 1 })}`, teamId: 'teamA', set: 1 },
]
const expulso = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil, eventosDoSet: eventos,
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), historico: [], setAtual: 1,
})
assert.deepEqual(expulso.expulsosNoSet, [7])
const entraExpulso = avaliarSubstituicao(expulso, { sai: 1, entra: 7 }, perfil)
assert.equal(entraExpulso.ok, false)
if (!entraExpulso.ok) assert.equal(entraExpulso.caixa.codigo, 'RG-SAN-007')
// desqualificado em set anterior segue impedido
const dq = reconstruirEstadoEquipe({
  elenco, liberos: [13], titulares: [1, 2, 3, 4, 5, 6], equipe: 'teamA', perfil, eventosDoSet: [],
  idPorCamisa: (c) => Number(c), idPorNumero: (c) => Number(c), setAtual: 2,
  historico: [{ equipe: 'A', membro: 'J:7', categoria: 'AGRESSAO', sancao: 'DESQUALIFICACAO', set: 1 }],
})
assert.deepEqual(dq.desqualificados, [7])
assert.equal(historicoDeSancoes(eventos).length, 1)

// --- tempos
assert.equal(limiteDeTemposDaTela(undefined), 2)
assert.equal(limiteDeTemposDaTela(3), 3)
assert.equal(textoTempo('Time A', 1, 2), 'Tempo solicitado por Time A (1/2 no set 2).')
assert.doesNotMatch(textoTempo('Time A', 1, 2), /técnico/i)
const t = avaliarTempo(2, 2, 'Time A')
assert.equal(t.ok, false)
if (!t.ok) assert.equal(t.caixa.codigo, 'RG-TMP-001')
const t3 = avaliarTempo(0, 3, 'Time A')
assert.equal(t3.ok && t3.aviso != null, true)

// --- ação corretiva sempre presente
assert.ok(acaoCorretiva('RG-XXX-999').length > 10)
assert.equal(caixaDeBloqueio('RG-SUB-001', 'm').acao, acaoCorretiva('RG-SUB-001'))

console.log('sumula-ui-motor ok')
