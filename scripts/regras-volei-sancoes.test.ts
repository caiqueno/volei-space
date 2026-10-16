import {
  aplicarSancaoNoEstado,
  avaliarSancao,
  chaveJogador,
  criarEstadoEquipe,
  membroImpedido,
  PERFIL_FIVB_CBV,
  caminhoParaJogadorImpedido,
  registrarSancao,
  validarQuadroDeSancoes,
  validarSubstituicaoRegular,
  type PedidoSancao,
  type SancaoAvaliada,
  type SancaoRegistrada,
} from '../src/lib/regras-volei'
import { assert, caso, encerrar } from './regras-volei-helper'

function avaliarOk(h: SancaoRegistrada[], p: PedidoSancao): SancaoAvaliada {
  const r = avaliarSancao(h, p)
  if (!r.ok) throw new Error(`sanção deveria ser aceita: ${r.mensagem}`)
  h.push(registrarSancao(p, r))
  return r
}

const j8 = chaveJogador(8)

caso('RG-TMP-007 / CJ-04: o 1º atraso da equipe na partida é advertência', () => {
  const h: SancaoRegistrada[] = []
  const r = avaliarOk(h, { equipe: 'A', membro: 'EQUIPE', categoria: 'ATRASO', set: 1 })
  assert.equal(r.sancao, 'ADVERTENCIA_ATRASO')
  assert.equal(r.pontoParaAdversario, false)
  assert.equal(r.colunaQuadro, 'A')
})

caso('RG-TMP-008 / CJ-04: novo atraso, mesmo em outro set, é penalidade (ponto e saque)', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: 'EQUIPE', categoria: 'ATRASO', set: 1 })
  const r = avaliarOk(h, { equipe: 'A', membro: 'EQUIPE', categoria: 'ATRASO', set: 3 })
  assert.equal(r.sancao, 'PENALIDADE_ATRASO')
  assert.equal(r.pontoParaAdversario, true)
  assert.equal(r.saqueParaAdversario, true)
  // atraso da outra equipe começa do zero
  assert.equal(avaliarOk(h, { equipe: 'B', membro: 'EQUIPE', categoria: 'ATRASO', set: 3 }).sancao, 'ADVERTENCIA_ATRASO')
})

caso('RG-SAN-001: conduta menor: advertência verbal e depois amarelo, sem consequência', () => {
  const h: SancaoRegistrada[] = []
  const a = avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'MENOR', set: 2 })
  assert.equal(a.sancao, 'ADVERTENCIA_VERBAL')
  const b = avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'MENOR', set: 2 })
  assert.equal(b.sancao, 'AMARELO')
  assert.equal(b.pontoParaAdversario, false)
  assert.equal(b.afastamento, 'NENHUM')
})

caso('RG-SAN-002 / CJ-04: 1ª grosseira é penalidade com ponto e saque ao adversário', () => {
  const h: SancaoRegistrada[] = []
  const r = avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  assert.equal(r.sancao, 'PENALIDADE')
  assert.equal(r.pontoParaAdversario, true)
  assert.equal(r.saqueParaAdversario, true)
  assert.equal(r.colunaQuadro, 'P')
})

caso('RG-SAN-003 / CJ-04: 2ª grosseira é expulsão do set, sem ponto, com substituição imediata', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  const r = avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  assert.equal(r.sancao, 'EXPULSAO')
  assert.equal(r.pontoParaAdversario, false)
  assert.equal(r.afastamento, 'SET')
  assert.equal(r.exigeSubstituicaoSeEmQuadra, true)
})

caso('RG-SAN-007: expulso fica fora até o fim do set e volta no set seguinte', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  assert.equal(membroImpedido(h, 'A', j8, 2), 'EXPULSO_NO_SET')
  assert.equal(membroImpedido(h, 'A', j8, 3), null)
  const nova = avaliarSancao(h, { equipe: 'A', membro: j8, categoria: 'MENOR', set: 2 })
  assert.equal(nova.ok, false)
  if (!nova.ok) assert.equal(nova.codigo, 'RG-SAN-007')
})

caso('RG-SAN-004 / CJ-04: 3ª grosseira na partida é desqualificação até o fim do jogo', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2 })
  const r = avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 3 })
  assert.equal(r.sancao, 'DESQUALIFICACAO')
  assert.equal(r.afastamento, 'PARTIDA')
  assert.equal(r.colunaQuadro, 'D')
  assert.equal(membroImpedido(h, 'A', j8, 5), 'DESQUALIFICADO')
  const depois = avaliarSancao(h, { equipe: 'A', membro: j8, categoria: 'MENOR', set: 5 })
  assert.equal(depois.ok, false)
  if (!depois.ok) assert.equal(depois.codigo, 'RG-SAN-008')
})

caso('RG-SAN-005 / CJ-04: 1ª ofensiva é expulsão (técnico: assistente assume); 2ª é desqualificação', () => {
  const h: SancaoRegistrada[] = []
  const a = avaliarOk(h, { equipe: 'A', membro: 'TECNICO', categoria: 'OFENSIVA', set: 3 })
  assert.equal(a.sancao, 'EXPULSAO')
  assert.equal(a.assistenteAssume, true)
  assert.equal(a.exigeSubstituicaoSeEmQuadra, false)
  const b = avaliarOk(h, { equipe: 'A', membro: 'TECNICO', categoria: 'OFENSIVA', set: 4 })
  assert.equal(b.sancao, 'DESQUALIFICACAO')
})

caso('RG-SAN-006: agressão ou ameaça é desqualificação direta', () => {
  const r = avaliarOk([], { equipe: 'B', membro: chaveJogador(3), categoria: 'AGRESSAO', set: 1 })
  assert.equal(r.sancao, 'DESQUALIFICACAO')
  assert.equal(r.pontoParaAdversario, false)
})

caso('RG-SAN-009: sanções são individuais por membro e progressivas', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 1 })
  // outro jogador da mesma equipe começa na 1ª ocorrência
  assert.equal(avaliarOk(h, { equipe: 'A', membro: chaveJogador(9), categoria: 'GROSSEIRA', set: 1 }).sancao, 'PENALIDADE')
  // o mesmo número na outra equipe também
  assert.equal(avaliarOk(h, { equipe: 'B', membro: j8, categoria: 'GROSSEIRA', set: 1 }).sancao, 'PENALIDADE')
})

caso('RG-SAN-010: sanção entre sets vale no set seguinte', () => {
  const r = avaliarOk([], { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 2, entreSets: true })
  assert.equal(r.setDeAplicacao, 3)
  assert.equal(r.pontoParaAdversario, true)
  assert.equal(r.avisos[0]?.codigo, 'RG-SAN-010')
})

caso('RG-SAN-011: o quadro de sanções é reprocessado em ordem de aplicação', () => {
  const pedidos: PedidoSancao[] = [
    { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 1 },
    { equipe: 'A', membro: j8, categoria: 'GROSSEIRA', set: 1 },
    { equipe: 'A', membro: j8, categoria: 'MENOR', set: 1 }, // expulso no set: inválido
  ]
  const r = validarQuadroDeSancoes(pedidos)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.mensagem, /Sanção 3/)
  assert.equal(validarQuadroDeSancoes(pedidos.slice(0, 2)).ok, true)
})

caso('RG-SAN-012: expulso em quadra sem banco leva a equipe incompleta', () => {
  const h: SancaoRegistrada[] = []
  avaliarOk(h, { equipe: 'A', membro: j8, categoria: 'OFENSIVA', set: 1 })
  const estado = criarEstadoEquipe({ elenco: [1, 2, 3, 4, 5, 8], formacaoInicial: [1, 2, 3, 4, 5, 8] })
  const expulsao = avaliarSancao([], { equipe: 'A', membro: j8, categoria: 'OFENSIVA', set: 1 })
  assert.equal(expulsao.ok, true)
  if (expulsao.ok) {
    const marcado = aplicarSancaoNoEstado(estado, 8, expulsao)
    assert.deepEqual(marcado.expulsosNoSet, [8])
    assert.equal(caminhoParaJogadorImpedido(marcado, 8, 'EXPULSAO', PERFIL_FIVB_CBV).via, 'INCOMPLETA')
  }
})

caso('RG-SAN-007: expulso não pode ser reinserido por substituição no mesmo set', () => {
  const estado = criarEstadoEquipe({ elenco: [1, 2, 3, 4, 5, 6, 7, 8], formacaoInicial: [1, 2, 3, 4, 5, 6] })
  const expulsao = avaliarSancao([], { equipe: 'A', membro: chaveJogador(7), categoria: 'OFENSIVA', set: 1 })
  if (!expulsao.ok) throw new Error('esperado ok')
  const marcado = aplicarSancaoNoEstado(estado, 7, expulsao)
  const r = validarSubstituicaoRegular(marcado, { sai: 1, entra: 7 }, PERFIL_FIVB_CBV)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.codigo, 'RG-SAN-007')
})

encerrar('regras-volei-sancoes')
