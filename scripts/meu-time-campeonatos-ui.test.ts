import assert from 'node:assert/strict'
import { urlBanco } from '../src/lib/banco-ui/cliente'
import { papelSomenteLeitura } from '../src/lib/banco-ui/papel'
import {
  abaExtraAtual,
  abasExtras,
  baseApiSessao,
  bancoSessaoAtivo,
  botaoDaOferta,
  caminhoEhAbaExtra,
  codigoPedeRecarregar,
  comTituloDeSolicitacao,
  inscricaoSolicitacaoAtiva,
  mensagemDeCodigo,
  mensagemRetorno,
  normalizarJogos,
  normalizarOfertas,
  ordenarJogos,
  prepararMensagem,
  ROTULO_MODO,
  ROTULO_SITUACAO,
  textoConfirmacao,
  textoSituacao,
  tituloSolicitacao,
  type JogoDoTime,
} from '../src/lib/meu-time-campeonatos-ui/regras'

// flags: só '1' liga
assert.equal(inscricaoSolicitacaoAtiva('1'), true)
assert.equal(inscricaoSolicitacaoAtiva('true'), false)
assert.equal(inscricaoSolicitacaoAtiva(undefined), false)
assert.equal(bancoSessaoAtivo('1'), true)
assert.equal(bancoSessaoAtivo(''), false)

// abas: desligadas = nada
assert.deepEqual(abasExtras(false, false), [])
assert.deepEqual(abasExtras(true, false).map((a) => a.rotulo), ['Campeonatos'])
assert.deepEqual(abasExtras(true, true).map((a) => a.rotulo), ['Campeonatos', 'Jogos'])
assert.equal(abaExtraAtual('/meu-time/jogos/1', { href: '/meu-time/jogos', rotulo: 'Jogos' }), true)
assert.equal(abaExtraAtual('/meu-time/jogosx', { href: '/meu-time/jogos', rotulo: 'Jogos' }), false)
assert.equal(caminhoEhAbaExtra('/meu-time/campeonatos'), true)
assert.equal(caminhoEhAbaExtra('/meu-time'), false)

// rótulos
assert.equal(ROTULO_MODO.AUTOMATICA, 'Inscrição automática')
assert.equal(ROTULO_MODO.APROVACAO, 'Com aprovação do organizador')
assert.deepEqual(Object.values(ROTULO_SITUACAO), ['Disponível', 'Aguardando aprovação', 'Inscrita', 'Recusada', 'Encerrada'])
assert.equal(textoSituacao({ situacao: 'RECUSADA', motivoRecusa: 'Vagas esgotadas' }), 'Recusada. Motivo: Vagas esgotadas')
assert.equal(textoSituacao({ situacao: 'RECUSADA' }), 'Recusada pelo organizador.')
assert.equal(textoSituacao({ situacao: 'PENDENTE' }), 'Aguardando aprovação')

// regra de botão
assert.deepEqual(botaoDaOferta({ modo: 'AUTOMATICA', situacao: 'DISPONIVEL' }), { acao: 'INSCREVER', rotulo: 'Inscrever' })
assert.deepEqual(botaoDaOferta({ modo: 'APROVACAO', situacao: 'DISPONIVEL' }), { acao: 'SOLICITAR', rotulo: 'Solicitar participação' })
assert.equal(botaoDaOferta({ modo: 'APROVACAO', situacao: 'RECUSADA' }).acao, 'SOLICITAR')
assert.deepEqual(botaoDaOferta({ modo: 'APROVACAO', situacao: 'PENDENTE', solicitacaoId: 's1' }), { acao: 'CANCELAR', rotulo: 'Cancelar solicitação' })
assert.equal(botaoDaOferta({ modo: 'APROVACAO', situacao: 'PENDENTE' }).acao, null)
assert.equal(botaoDaOferta({ modo: 'AUTOMATICA', situacao: 'INSCRITA' }).acao, null)
assert.equal(botaoDaOferta({ modo: 'AUTOMATICA', situacao: 'ENCERRADA' }).acao, null)

// mensagem e confirmação
assert.equal(prepararMensagem('   '), undefined)
assert.equal(prepararMensagem('  oi  '), 'oi')
assert.equal(prepararMensagem('a'.repeat(500))?.length, 300)
assert.match(textoConfirmacao({ modo: 'AUTOMATICA', campeonato: 'Copa', categoria: 'Sub-17' }, 'Time A'), /Inscrever Time A em Copa, categoria Sub-17/)
assert.match(textoConfirmacao({ modo: 'APROVACAO', campeonato: 'Copa', categoria: 'Sub-17' }, 'Time A'), /Pedir ao organizador/)
assert.match(mensagemRetorno('INSCRITA', 'AUTOMATICA'), /inscrito/)
assert.match(mensagemRetorno('PENDENTE', 'APROVACAO'), /esperar o organizador/)
assert.match(mensagemDeCodigo('SOLICITACAO_PENDENTE') ?? '', /aguardando/)
assert.match(mensagemDeCodigo('JA_INSCRITA') ?? '', /já está inscrito/)
assert.equal(mensagemDeCodigo('OUTRO'), null)
assert.equal(codigoPedeRecarregar('JA_INSCRITA'), true)
assert.equal(codigoPedeRecarregar(undefined), false)

// normalização
const ofertas = normalizarOfertas([
  { ligaId: 'l', categoriaId: 'c1', campeonato: 'Copa', categoria: 'Adulto', naipe: 'FEMININO', modo: 'AUTOMATICA', situacao: 'DISPONIVEL' },
  { categoriaId: 'c2', modo: 'X', situacao: 'Y', solicitacaoId: 9, motivoRecusa: ' ' },
  { campeonato: 'sem categoria' },
])
assert.equal(ofertas.length, 2)
assert.equal(ofertas[1].modo, 'APROVACAO')
assert.equal(ofertas[1].situacao, 'ENCERRADA')
assert.equal(ofertas[1].solicitacaoId, '9')
assert.equal(ofertas[1].motivoRecusa, undefined)
assert.deepEqual(normalizarOfertas(null), [])

// jogos
const jogos = normalizarJogos([
  { partidaId: 2, equipeId: 'e', adversario: 'B', horario: '2026-10-19T10:00:00Z', status: 'AGENDADA', papeletaPendente: true },
  { partidaId: 1, equipeId: 'e', horario: '2026-10-18T10:00:00Z', status: 'ENCERRADA' },
  { partidaId: 3, equipeId: 'e', status: 'AGENDADA' },
  { equipeId: 'e' },
])
assert.equal(jogos.length, 3)
assert.equal(jogos[1].adversario, 'Adversário a definir')
assert.deepEqual(ordenarJogos(jogos as JogoDoTime[]).map((j) => j.partidaId), ['2', '3', '1'])

// baseApi do banco: padrão por token, sessão por partida/equipe
assert.equal(urlBanco('abc', '/pedidos'), '/api/banco/abc/pedidos')
assert.equal(urlBanco('a b', ''), '/api/banco/a%20b')
assert.equal(baseApiSessao(10, 'eq1'), '/api/banco/sessao/10/eq1')
assert.equal(urlBanco('x', '/papeleta/1/enviar', baseApiSessao(10, 'eq1')), '/api/banco/sessao/10/eq1/papeleta/1/enviar')
assert.equal(urlBanco('x', '/pedidos/5', '/api/banco/sessao/1/2/'), '/api/banco/sessao/1/2/pedidos/5')

// papel
assert.equal(papelSomenteLeitura('LIDER'), false)
assert.equal(papelSomenteLeitura(undefined), false)
assert.equal(papelSomenteLeitura('ASSISTENTE'), true)
assert.equal(papelSomenteLeitura('assistente'), true)
assert.equal(papelSomenteLeitura('QUALQUER'), true)

// notificações
assert.equal(tituloSolicitacao({ tipo: 'CONVITE_USADO' }), null)
assert.match(tituloSolicitacao({ tipo: 'SOLICITACAO_APROVADA', payload: { campeonato: 'Copa', categoria: 'Sub-17' } }) ?? '', /aceito: Copa, Sub-17/)
assert.match(tituloSolicitacao({ tipo: 'SOLICITACAO_RECUSADA', payload: { campeonato: 'Copa', motivo: 'Sem vaga' } }) ?? '', /recusado: Copa\. Motivo: Sem vaga/)
assert.equal(tituloSolicitacao({ tipo: 'SOLICITACAO_RECUSADA', payload: {} }), 'Seu pedido de participação foi recusado')
const n = comTituloDeSolicitacao({ id: '1', tipo: 'SOLICITACAO_APROVADA', payload: { campeonato: 'Copa' } as Record<string, unknown> })
assert.equal(n.payload.titulo, 'Seu time foi aceito: Copa')
const outro = { tipo: 'X', payload: {} }
assert.equal(comTituloDeSolicitacao(outro), outro)

console.log('meu-time-campeonatos-ui: ok')
