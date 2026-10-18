/** Solicitações de inscrição do organizador: lógica pura da tela. */
import assert from 'node:assert/strict'
import {
  campeonatosDaLista, contarPendentes, destinoNotificacao, filtrarPorCampeonato, limparMotivo, normalizarModo,
  normalizarNotificacoes, normalizarSolicitacoes, podeDecidir, rotuloContador, rotuloEstado, rotuloModo,
  solicitacoesAtivo, textoAtletas, tratarResposta, urlSolicitacoes, MOTIVO_MAX,
} from '../src/lib/organizador-solicitacoes-ui'

// Flag: só '1'.
assert.equal(solicitacoesAtivo('1'), true)
assert.equal(solicitacoesAtivo('true'), false)
assert.equal(solicitacoesAtivo(undefined), false)

// Rótulos.
assert.equal(rotuloEstado('PENDENTE'), 'Pendente')
assert.equal(rotuloEstado('APROVADA'), 'Aprovada')
assert.equal(rotuloEstado('XYZ'), 'Desconhecido')
assert.equal(normalizarModo('aprovacao'), 'APROVACAO')
assert.equal(normalizarModo(undefined), 'AUTOMATICA')
assert.equal(rotuloModo('APROVACAO'), 'Com aprovação do organizador')
assert.equal(textoAtletas(1), '1 atleta')
assert.equal(textoAtletas(12), '12 atletas')

// Botões só em pendente.
assert.equal(podeDecidir('PENDENTE'), true)
for (const e of ['APROVADA', 'RECUSADA', 'CANCELADA']) assert.equal(podeDecidir(e), false)

// Contador.
assert.equal(contarPendentes([{ estado: 'PENDENTE' }, { estado: 'APROVADA' }, { estado: 'PENDENTE' }]), 2)
assert.equal(rotuloContador(0), '')
assert.equal(rotuloContador(-3), '')
assert.equal(rotuloContador(7), '7')
assert.equal(rotuloContador(150), '99+')

// Motivo.
assert.equal(limparMotivo('   '), undefined)
assert.equal(limparMotivo(' sem vaga '), 'sem vaga')
assert.equal(limparMotivo('a'.repeat(1000))?.length, MOTIVO_MAX)

// Normalização tolerante.
const lista = normalizarSolicitacoes({
  data: [
    { id: 1, equipe: { id: 2, nome: 'Alfa', cidade: 'SP' }, ligaId: 9, campeonato: 'Copa', categoria: 'Livre', mensagem: 'oi', estado: 'PENDENTE', solicitadoEm: '2026-01-01T10:00:00Z', atletas: 8 },
    { id: 3, equipe: null, ligaId: 10, campeonato: 'Liga B', categoria: 'Sub', estado: 'LIXO', atletas: 'x' },
    null,
  ],
})
assert.equal(lista.length, 2)
assert.equal(lista[0].equipe.nome, 'Alfa')
assert.equal(lista[1].equipe.nome, 'Equipe')
assert.equal(lista[1].estado, 'PENDENTE')
assert.equal(lista[1].atletas, 0)
assert.deepEqual(normalizarSolicitacoes({}), [])
assert.equal(filtrarPorCampeonato(lista, '9').length, 1)
assert.equal(filtrarPorCampeonato(lista, '').length, 2)
assert.deepEqual(campeonatosDaLista(lista).map((c) => c.nome), ['Copa', 'Liga B'])
assert.equal(urlSolicitacoes('PENDENTE'), '/api/organizador/solicitacoes?estado=PENDENTE')
assert.equal(urlSolicitacoes('APROVADA', '9'), '/api/organizador/solicitacoes?estado=APROVADA&ligaId=9')

// Notificações.
const n = normalizarNotificacoes({ data: [{ id: 'a', tipo: 'SOLICITACAO_INSCRICAO', titulo: 'T', mensagem: 'M', lida: false }, { id: 'b', lida: true }], naoLidas: 1 })
assert.equal(n.lista.length, 2)
assert.equal(n.naoLidas, 1)
assert.equal(normalizarNotificacoes({ data: [{ id: 'a' }] }).naoLidas, 1)
assert.equal(normalizarNotificacoes(null).lista.length, 0)
assert.equal(destinoNotificacao('SOLICITACAO_INSCRICAO'), '/admin/solicitacoes')
assert.equal(destinoNotificacao('OUTRA'), null)

// Status da API.
assert.equal(tratarResposta(200).ok, true)
assert.equal(tratarResposta(404).tipo, 'desligado')
assert.equal(tratarResposta(503).tipo, 'nao-habilitado')
const c = tratarResposta(409, { error: 'Já recusada.' })
assert.equal(c.tipo, 'conflito')
assert.equal(c.recarregar, true)
assert.equal(c.mensagem, 'Já recusada.')
assert.equal(tratarResposta(403).tipo, 'sessao')
assert.equal(tratarResposta(500, { error: 'boom' }).mensagem, 'boom')
assert.equal(tratarResposta(500).tipo, 'generica')

console.log('organizador-solicitacoes-ui: ok')
