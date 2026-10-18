import assert from 'node:assert/strict'
import { criarClienteCampeonatos } from '../src/components/meu-time-campeonatos/cliente'
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
  alternarAtleta,
  limitesDoErro,
  maximoParaEscolha,
  mensagemErroSolicitacao,
  normalizarAtletasDoBanco,
  ordenarAtletas,
  selecaoValida,
  textoContagemSelecao,
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

// erros do POST de solicitação
assert.equal(mensagemErroSolicitacao({ codigo: 'TIME_SEM_ATLETAS', mensagem: 'x' }), 'Cadastre atletas no time antes de se inscrever.')
assert.equal(mensagemErroSolicitacao({ codigo: 'CONVITE_OBRIGATORIO', mensagem: 'x' }), 'Esta competição é por convite. Peça o link de inscrição ao organizador.')
assert.equal(mensagemErroSolicitacao({ codigo: 'INSCRICOES_FECHADAS', mensagem: 'x' }), 'As inscrições desta categoria estão fechadas.')
assert.match(mensagemErroSolicitacao({ codigo: 'NAIPE_INCOMPATIVEL', mensagem: 'x' }), /naipe/)
assert.equal(
  mensagemErroSolicitacao({ codigo: 'ABAIXO_DO_MINIMO', mensagem: 'Faltam 3 atleta(s) para chegar ao mínimo de 8.' }),
  'Esta categoria pede no mínimo 8 atletas. Seu time tem 5. Cadastre mais 3 atletas e tente de novo.',
)
assert.equal(
  mensagemErroSolicitacao({ codigo: 'ABAIXO_DO_MINIMO', mensagem: 'Faltam 1 atleta(s) para chegar ao mínimo de 6.' }),
  'Esta categoria pede no mínimo 6 atletas. Seu time tem 5. Cadastre mais 1 atleta e tente de novo.',
)
assert.match(mensagemErroSolicitacao({ codigo: 'ABAIXO_DO_MINIMO', mensagem: 'texto sem números' }), /menos atletas/)
assert.equal(
  mensagemErroSolicitacao({ codigo: 'ACIMA_DO_MAXIMO', mensagem: 'Remova 4 atleta(s): o máximo é 12.' }),
  'Esta categoria aceita no máximo 12 atletas. Seu time tem 16. Escolha quem entra.',
)
assert.match(mensagemErroSolicitacao({ codigo: 'ACIMA_DO_MAXIMO', mensagem: 'O banco do time tem atletas demais para numerar de 0 a 99.' }), /atletas demais/)
assert.equal(mensagemErroSolicitacao({ codigo: 'SOLICITACAO_PENDENTE', mensagem: 'x' }), 'Já existe um pedido seu aguardando o organizador para esta categoria.')
assert.equal(mensagemErroSolicitacao({ codigo: 'OUTRO', mensagem: 'Texto do servidor.' }), 'Texto do servidor.')
assert.deepEqual(limitesDoErro('ACIMA_DO_MAXIMO', 'Remova 2 atleta(s): o máximo é 10.'), { minimo: null, maximo: 10, diferenca: 2 })
assert.deepEqual(limitesDoErro('ABAIXO_DO_MINIMO', 'Faltam 2 atleta(s) para chegar ao mínimo de 8.'), { minimo: 8, maximo: null, diferenca: 2 })
assert.deepEqual(limitesDoErro('X', 'o máximo é 3'), { minimo: null, maximo: null, diferenca: null })

// escolha de atletas só no excesso
assert.equal(maximoParaEscolha({ codigo: 'ACIMA_DO_MAXIMO', mensagem: 'Remova 4 atleta(s): o máximo é 12.' }), 12)
assert.equal(maximoParaEscolha({ codigo: 'ACIMA_DO_MAXIMO', mensagem: 'sem número' }), null)
assert.equal(maximoParaEscolha({ codigo: 'ABAIXO_DO_MINIMO', mensagem: 'Faltam 1 atleta(s) para chegar ao mínimo de 6.' }), null)
assert.equal(maximoParaEscolha({ mensagem: 'o máximo é 5' }), null)

assert.deepEqual(alternarAtleta([], 'a', 2), ['a'])
assert.deepEqual(alternarAtleta(['a'], 'b', 2), ['a', 'b'])
assert.deepEqual(alternarAtleta(['a', 'b'], 'c', 2), ['a', 'b'])
assert.deepEqual(alternarAtleta(['a', 'b'], 'a', 2), ['b'])
const base = ['a']
alternarAtleta(base, 'b', 3)
assert.deepEqual(base, ['a'])
assert.equal(selecaoValida([], 3), false)
assert.equal(selecaoValida(['a'], 3), true)
assert.equal(selecaoValida(['a', 'b', 'c', 'd'], 3), false)
assert.equal(textoContagemSelecao(0, 12), 'Escolha até 12 atletas.')
assert.equal(textoContagemSelecao(5, 12), '5 de 12 escolhidos. Ainda cabem 7 atletas.')
assert.equal(textoContagemSelecao(11, 12), '11 de 12 escolhidos. Ainda cabem 1 atleta.')
assert.equal(textoContagemSelecao(12, 12), '12 de 12 escolhidos. Para trocar, desmarque alguém.')

const banco = normalizarAtletasDoBanco([
  { id: 'z', nome: 'Zeca', numeroPreferido: null, cpf: '123' },
  { id: 'b', nome: 'Bia', numeroPreferido: 7 },
  { id: 'a', nome: 'Ana', numeroPreferido: 7 },
  { id: 'c', nome: 'Caio', numeroPreferido: 1 },
  { id: '', nome: 'Sem id' },
  { id: 'q', nome: '' },
  null,
])
assert.equal(banco.length, 4)
assert.deepEqual(banco[0], { id: 'z', nome: 'Zeca', numeroPreferido: null })
assert.deepEqual(ordenarAtletas(banco).map((a) => a.id), ['c', 'a', 'b', 'z'])
assert.deepEqual(normalizarAtletasDoBanco('x'), [])

// cliente: o POST leva os ids dos atletas só quando houver escolha; a lista vem do detalhe da equipe
async function clienteDeTeste() {
  const chamadas: Array<{ url: string; metodo: string; corpo: unknown }> = []
  const falso = (async (url: string, init?: { method?: string; body?: string }) => {
    chamadas.push({ url, metodo: init?.method ?? 'GET', corpo: init?.body ? JSON.parse(init.body) : undefined })
    const dado = String(url).includes('/solicitacoes')
      ? { data: { estado: 'PENDENTE', id: 9 } }
      : { data: { atletas: [{ id: 'a1', nome: 'Ana', numeroPreferido: 3, cpf: 'x' }] } }
    return { ok: true, status: 200, json: async () => dado }
  }) as unknown as typeof fetch
  const api = criarClienteCampeonatos(falso)
  await api.solicitar('e1', 'c1', 'oi', ['a1', 'a2'])
  await api.solicitar('e1', 'c1')
  await api.solicitar('e1', 'c1', undefined, [])
  const lista = await api.listarAtletas('e1')
  return { chamadas, lista }
}
void clienteDeTeste().then(({ chamadas, lista }) => {
  assert.deepEqual(chamadas[0].corpo, { equipeId: 'e1', categoriaId: 'c1', mensagem: 'oi', atletas: ['a1', 'a2'] })
  assert.deepEqual(chamadas[1].corpo, { equipeId: 'e1', categoriaId: 'c1' })
  assert.deepEqual(chamadas[2].corpo, { equipeId: 'e1', categoriaId: 'c1' })
  assert.equal(chamadas[3].url, '/api/meu-time/equipes/e1')
  assert.deepEqual(lista, [{ id: 'a1', nome: 'Ana', numeroPreferido: 3 }])
  console.log('meu-time-campeonatos-ui cliente: ok')
})

console.log('meu-time-campeonatos-ui: ok')
