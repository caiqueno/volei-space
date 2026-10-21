/** Inscrições e Minha equipe do organizador: lógica pura da tela. */
import assert from 'node:assert/strict'
import {
  ABAS, acoesPermitidas, contarPorAba, contarParaMenu, corpoConvite, corpoDecisao, corpoLote, estaParada, exigeMensagem,
  falhaBloqueante, filtrarPorAba, filtrarPorCategoria, motivoBloqueio, normalizarDetalhe, normalizarEquipe, normalizarInscricoes,
  painelInscricoesAtivo, podeAprovarEmLote, rotuloContador, rotuloStatus, statusDaAba, tempoParado, textoVazio, tratarResposta,
  urlDecidir, urlDocumento, urlDocumentoSegura, urlExportar, urlInscricoes, validarDecisao, validarEmail, campeonatosDaLista,
} from '../src/lib/painel-inscricoes-ui'

// Flag: só '1'.
assert.equal(painelInscricoesAtivo('1'), true)
assert.equal(painelInscricoesAtivo('true'), false)
assert.equal(painelInscricoesAtivo(undefined), false)

// Querystring: ignora lixo, normaliza busca, pagina só a partir da 2.
assert.equal(urlInscricoes(), '/api/organizador/inscricoes')
assert.equal(urlInscricoes({ ligaId: '3', categoriaId: '7', status: 'EM_ANALISE', q: '  lobos ', pagina: 2 }), '/api/organizador/inscricoes?ligaId=3&categoriaId=7&status=EM_ANALISE&q=lobos&pagina=2')
assert.equal(urlInscricoes({ ligaId: '3; drop', status: 'XX', pagina: 1 }), '/api/organizador/inscricoes')
assert.equal(urlExportar({ ligaId: '3', status: 'CONFIRMADA' }), '/api/organizador/inscricoes/exportar?ligaId=3&status=CONFIRMADA')
assert.equal(urlDecidir('a/b'), '/api/organizador/inscricoes/a%2Fb/decidir')
assert.equal(urlDocumento('9', '4'), '/api/organizador/inscricoes/9/atletas/4/documento-url')
assert.equal(urlDocumentoSegura('https://x.supabase.co/a?t=1'), 'https://x.supabase.co/a?t=1')
assert.equal(urlDocumentoSegura('javascript:alert(1)'), null)
assert.equal(urlDocumentoSegura('http://x.com/a'), null)
assert.equal(urlDocumentoSegura(null), null)

// Normalização da lista.
const lista = normalizarInscricoes({
  data: {
    total: 30,
    itens: [
      { id: 1, equipe: { id: 5, nome: 'Lobos', cidade: 'Natal' }, categoria: 'Adulto', campeonato: 'Copa', status: 'EM_ANALISE', atletas: 10, pendencias: ['foto'], atualizadoEm: '2026-01-01T00:00:00Z', comentariosAbertos: 2 },
      { id: 2, equipe: { nome: 'Águias' }, status: 'LISTA_ESPERA', posicaoEspera: 3 },
      { id: 3, status: 'CONFIRMADA' },
      { id: 4, status: 'INVALIDO' },
      { equipe: { nome: 'sem id' } },
    ],
  },
})
assert.equal(lista.itens.length, 4)
assert.equal(lista.total, 30)
assert.equal(lista.itens[0].equipe.cidade, 'Natal')
assert.deepEqual(lista.itens[0].pendencias, ['foto'])
assert.equal(lista.itens[1].posicaoEspera, 3)
assert.equal(lista.itens[2].equipe.nome, 'Equipe')
assert.equal(lista.itens[3].status, 'EM_ANALISE')
assert.deepEqual(normalizarInscricoes(null), { itens: [], total: 0 })
assert.equal(normalizarInscricoes({ data: { itens: [{ id: 1 }], total: 0 } }).total, 1)

// Contadores e abas.
const mista = [
  { status: 'EM_ANALISE' }, { status: 'EM_ANALISE' }, { status: 'AJUSTE_PEDIDO' }, { status: 'CONFIRMADA_COM_PENDENCIAS' },
  { status: 'LISTA_ESPERA' }, { status: 'CONFIRMADA' }, { status: 'REMOVIDA' }, { status: 'RASCUNHO' },
]
assert.deepEqual(contarPorAba(mista), { EM_ANALISE: 2, PENDENCIA: 2, LISTA_ESPERA: 1, APROVADAS: 1, RECUSADAS: 1 })
assert.equal(contarParaMenu(mista), 4)
assert.equal(filtrarPorAba(mista, 'PENDENCIA').length, 2)
assert.deepEqual(statusDaAba('APROVADAS'), ['CONFIRMADA'])
assert.equal(ABAS.length, 5)
assert.equal(rotuloContador(0), '')
assert.equal(rotuloContador(120), '99+')
assert.equal(rotuloContador(7), '7')

// Transições por status e papel.
assert.deepEqual(acoesPermitidas('EM_ANALISE', 'ADMINISTRADOR'), ['APROVAR', 'PEDIR_CORRECAO', 'LISTA_ESPERA', 'RECUSAR'])
assert.deepEqual(acoesPermitidas('EM_ANALISE', null), ['APROVAR', 'PEDIR_CORRECAO', 'LISTA_ESPERA', 'RECUSAR'])
assert.deepEqual(acoesPermitidas('EM_ANALISE', 'FINANCEIRO'), [])
assert.deepEqual(acoesPermitidas('EM_ANALISE', 'ARBITRAGEM'), [])
assert.deepEqual(acoesPermitidas('REMOVIDA', 'ADMINISTRADOR'), ['ANALISAR'])
assert.deepEqual(acoesPermitidas('RASCUNHO', 'ADMINISTRADOR'), [])
assert.equal(acoesPermitidas('CONFIRMADA', 'ADMINISTRADOR').includes('APROVAR'), false)
assert.equal(podeAprovarEmLote('LISTA_ESPERA', 'ADMINISTRADOR'), true)
assert.equal(podeAprovarEmLote('CONFIRMADA', 'ADMINISTRADOR'), false)
assert.equal(podeAprovarEmLote('EM_ANALISE', 'FINANCEIRO'), false)
assert.ok(motivoBloqueio('FINANCEIRO').includes('Financeiro'))
assert.equal(motivoBloqueio('ADMINISTRADOR'), '')
assert.equal(motivoBloqueio(null), '')

// Mensagem obrigatória.
assert.equal(exigeMensagem('RECUSAR'), true)
assert.equal(exigeMensagem('PEDIR_CORRECAO'), true)
assert.equal(exigeMensagem('APROVAR'), false)
assert.ok(validarDecisao('RECUSAR', '   '))
assert.ok(validarDecisao('PEDIR_CORRECAO', ''))
assert.equal(validarDecisao('PEDIR_CORRECAO', 'Foto borrada'), null)
assert.equal(validarDecisao('APROVAR', ''), null)
assert.deepEqual(corpoDecisao('APROVAR', ''), { acao: 'APROVAR' })
assert.deepEqual(corpoDecisao('RECUSAR', ' sem vaga '), { acao: 'RECUSAR', mensagem: 'sem vaga' })
assert.equal(corpoDecisao('RECUSAR', 'x'.repeat(900)).mensagem?.length, 500)
assert.deepEqual(corpoLote(['1', '2', '1']), { ids: ['1', '2'], acao: 'APROVAR' })

// Respostas.
assert.equal(tratarResposta(200).ok, true)
assert.equal(tratarResposta(404).tipo, 'desligado')
assert.equal(tratarResposta(503).tipo, 'nao-habilitado')
assert.equal(tratarResposta(409).tipo, 'conflito')
assert.equal(tratarResposta(409).recarregar, true)
assert.equal(tratarResposta(409, { error: 'Já aprovada' }).mensagem, 'Já aprovada')
assert.equal(tratarResposta(403).tipo, 'sessao')
assert.equal(tratarResposta(400, { error: 'Mensagem obrigatória' }).tipo, 'validacao')
assert.equal(tratarResposta(500).tipo, 'generica')
assert.equal(falhaBloqueante('desligado'), true)
assert.equal(falhaBloqueante('conflito'), false)

// Detalhe: sem PII, só flags.
const det = normalizarDetalhe({
  data: {
    id: 9, equipe: { nome: 'Lobos' }, status: 'EM_ANALISE',
    atletas: [{ id: 1, nome: 'Ana S.', camisa: 0, capitao: true, temFoto: true, temCpf: false }, { id: 2, nome: 'Bia L.', camisa: '', libero: true, temDocumento: true }, { nome: 'sem id' }],
    comissao: [{ nome: 'Téc', funcao: 'Técnico' }, { nome: '' }],
    comentarios: [{ id: 1, autor: 'Org', texto: 'Falta foto', criadoEm: '2026-01-02T00:00:00Z' }, { texto: '' }],
  },
})
assert.ok(det)
assert.equal(det.atletasLista.length, 2)
assert.equal(det.atletasLista[0].camisa, 0)
assert.equal(det.atletasLista[1].camisa, null)
assert.equal(det.atletasLista[1].libero, true)
assert.equal(det.atletas, 2)
assert.equal(det.comissao.length, 1)
assert.equal(det.comentarios.length, 1)
assert.equal(normalizarDetalhe({ data: null }), null)

// Equipe.
const eq = normalizarEquipe({ data: { meuPapel: 'administrador', membros: [{ email: 'a@x.com', papel: 'FINANCEIRO' }, { email: 'b@x.com', papel: 'XX' }, { email: 'c@x.com', papel: 'ARBITRAGEM', status: 'PENDENTE' }] } })
assert.equal(eq.membros.length, 2)
assert.equal(eq.meuPapel, 'ADMINISTRADOR')
assert.equal(eq.membros[1].pendente, true)
assert.equal(normalizarEquipe({ data: [{ email: 'a@x.com', papel: 'ADMINISTRADOR' }] }).membros.length, 1)
assert.equal(normalizarEquipe(null).meuPapel, null)
assert.equal(validarEmail(''), 'Informe o e-mail.')
assert.equal(validarEmail('abc'), 'E-mail inválido.')
assert.equal(validarEmail('a@b.com'), null)
assert.deepEqual(corpoConvite(' A@B.com ', 'FINANCEIRO'), { email: 'a@b.com', papel: 'FINANCEIRO' })

// Textos e tempo.
const agora = Date.parse('2026-01-10T12:00:00Z')
assert.equal(tempoParado('2026-01-10T11:59:40Z', agora), 'agora')
assert.equal(tempoParado('2026-01-10T11:30:00Z', agora), 'há 30 min')
assert.equal(tempoParado('2026-01-10T07:00:00Z', agora), 'há 5 h')
assert.equal(tempoParado('2026-01-09T10:00:00Z', agora), 'há 1 dia')
assert.equal(tempoParado('2026-01-05T12:00:00Z', agora), 'há 5 dias')
assert.equal(tempoParado(null, agora), '')
assert.equal(estaParada('EM_ANALISE', '2026-01-05T12:00:00Z', agora), true)
assert.equal(estaParada('EM_ANALISE', '2026-01-09T12:00:00Z', agora), false)
assert.equal(estaParada('CONFIRMADA', '2026-01-01T12:00:00Z', agora), false)
assert.equal(rotuloStatus('REMOVIDA'), 'Recusada')
assert.ok(textoVazio('EM_ANALISE', false).includes('análise'))
assert.equal(textoVazio('EM_ANALISE', true), 'Nenhuma inscrição com esses filtros.')

// Filtros do cliente.
assert.deepEqual(campeonatosDaLista([{ ligaId: '2', campeonato: 'Zeta' }, { ligaId: '1', campeonato: 'Alfa' }, { ligaId: '2', campeonato: 'Zeta' }]).map((c) => c.nome), ['Alfa', 'Zeta'])
assert.equal(filtrarPorCategoria([{ categoria: 'A' }, { categoria: 'B' }], 'B').length, 1)
assert.equal(filtrarPorCategoria([{ categoria: 'A' }], '').length, 1)

console.log('painel-inscricoes-ui: ok')
