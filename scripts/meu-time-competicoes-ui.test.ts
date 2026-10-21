import assert from 'node:assert/strict'
import { criarClienteCompeticoes } from '../src/components/meu-time-competicoes/cliente'
import {
  aplicarFiltro,
  caminhoEhCompeticoes,
  caminhoEhExplorar,
  contarFiltrosAtivos,
  destinoCompeticoes,
  erroDoPeriodo,
  explorarCompeticoesAtivo,
  filtrosVazios,
  hrefParticipar,
  montarQuerystring,
  motivoSemParticipar,
  normalizarCompeticoes,
  podeParticipar,
  prazoRestante,
  textoDoSelo,
  textoPagina,
  textoPeriodo,
  textoValor,
  textoVazio,
  totalPaginas,
  urlListagem,
  vagasDe,
  visualDoSelo,
} from '../src/lib/meu-time-competicoes-ui/regras'
import {
  descreverStatus,
  estadoDaEtapa,
  normalizarComentarios,
  podeResponder,
  prepararComentario,
  textoPosicaoEspera,
} from '../src/lib/meu-time-competicoes-ui/status'

// flag: só '1' liga
assert.equal(explorarCompeticoesAtivo('1'), true)
assert.equal(explorarCompeticoesAtivo('true'), false)
assert.equal(explorarCompeticoesAtivo(undefined), false)
assert.equal(destinoCompeticoes('/meu-time/campeonatos', false), '/meu-time/campeonatos')
assert.equal(destinoCompeticoes('/meu-time/campeonatos', true), '/meu-time/competicoes')
assert.equal(caminhoEhCompeticoes('/meu-time/campeonatos'), true)
assert.equal(caminhoEhExplorar('/meu-time/campeonatos'), false)
assert.equal(caminhoEhExplorar('/meu-time/competicoes'), true)

// querystring
const vazios = filtrosVazios()
assert.equal(montarQuerystring({ ...vazios, abertas: false }), '')
assert.equal(montarQuerystring(vazios), 'abertas=1')
const cheio = { ...vazios, equipeId: 'e1', cidade: ' Recife ', de: '2026-11-01', ate: '2026-12-01', categoria: 'Adulto', naipe: 'FEMININO', q: 'copa', pagina: 3 }
const qs = new URLSearchParams(montarQuerystring(cheio))
assert.equal(qs.get('equipeId'), 'e1')
assert.equal(qs.get('cidade'), 'Recife')
assert.equal(qs.get('de'), '2026-11-01')
assert.equal(qs.get('naipe'), 'FEMININO')
assert.equal(qs.get('abertas'), '1')
assert.equal(qs.get('pagina'), '3')
assert.equal(new URLSearchParams(montarQuerystring({ ...vazios, naipe: 'XYZ', de: '31/12/2026', pagina: 1 })).has('naipe'), false)
assert.equal(new URLSearchParams(montarQuerystring({ ...vazios, de: '2026-02-31' })).has('de'), false)
assert.equal(new URLSearchParams(montarQuerystring({ ...vazios, pagina: -2 })).has('pagina'), false)
assert.equal(new URLSearchParams(montarQuerystring({ ...vazios, q: 'a&b=c' })).get('q'), 'a&b=c')
assert.equal(urlListagem({ ...vazios, abertas: false }), '/api/meu-time/competicoes')
assert.equal(urlListagem(vazios), '/api/meu-time/competicoes?abertas=1')
assert.equal(aplicarFiltro({ ...vazios, pagina: 4 }, { cidade: 'Natal' }).pagina, 1)
assert.equal(contarFiltrosAtivos({ ...vazios, abertas: false }), 0)
assert.equal(contarFiltrosAtivos(cheio), 6)
assert.equal(erroDoPeriodo({ de: '2026-12-01', ate: '2026-11-01' }) !== null, true)
assert.equal(erroDoPeriodo({ de: '2026-11-01', ate: '2026-12-01' }), null)
assert.equal(erroDoPeriodo({ de: '', ate: '' }), null)
assert.equal(erroDoPeriodo({ de: 'abc', ate: '' }) !== null, true)

// paginação
assert.equal(totalPaginas(0), 1)
assert.equal(totalPaginas(20), 1)
assert.equal(totalPaginas(21), 2)
assert.equal(textoPagina(2, 45), 'Página 2 de 3')

// selo
assert.equal(visualDoSelo('OK').icone, '✅')
assert.equal(visualDoSelo('AVISO').icone, '⚠️')
assert.equal(visualDoSelo('BLOQUEIO').icone, '⛔')
assert.equal(visualDoSelo('OK').classe, 'is-success')
assert.equal(visualDoSelo('AVISO').classe, 'is-warning')
assert.equal(visualDoSelo('BLOQUEIO').classe, 'is-error')
assert.equal(textoDoSelo({ nivel: 'OK', texto: 'Elegível', detalhes: [] }), 'Elegível')
assert.equal(textoDoSelo({ nivel: 'BLOQUEIO', texto: '  ', detalhes: [] }), 'Não pode participar')
const bloq = { selo: { nivel: 'BLOQUEIO' as const, texto: 'x', detalhes: [] }, situacao: 'DISPONIVEL' }
assert.equal(podeParticipar(bloq), false)
assert.equal(podeParticipar({ selo: null, situacao: 'DISPONIVEL' }), true)
assert.equal(podeParticipar({ selo: { nivel: 'AVISO', texto: '', detalhes: [] }, situacao: 'DISPONIVEL' }), true)
assert.equal(podeParticipar({ selo: null, situacao: 'INSCRITA' }), false)
assert.equal(podeParticipar({ selo: null, situacao: 'ENCERRADA' }), false)
assert.equal(motivoSemParticipar({ selo: null, situacao: 'DISPONIVEL' }), null)
assert.ok(motivoSemParticipar(bloq))

// prazo (calendário local)
const agora = new Date(2026, 9, 21, 15, 0, 0)
assert.equal(prazoRestante(new Date(2026, 9, 24, 8).toISOString(), agora), 'Faltam 3 dias')
assert.equal(prazoRestante(new Date(2026, 9, 22, 23).toISOString(), agora), 'Falta 1 dia')
assert.equal(prazoRestante(new Date(2026, 9, 21, 23).toISOString(), agora), 'Último dia para se inscrever')
assert.equal(prazoRestante(new Date(2026, 9, 20, 23).toISOString(), agora), 'Inscrições encerradas')
assert.equal(prazoRestante(null, agora), null)
assert.equal(prazoRestante('lixo', agora), null)

// valor, vagas, período
assert.equal(textoValor(0), 'Gratuito')
assert.equal(textoValor(null), 'Valor a combinar')
assert.match(textoValor(150), /R\$\s?150,00/)
assert.deepEqual(vagasDe(3, 12), { texto: '3 vagas restantes de 12', percentualOcupado: 75, esgotada: false })
assert.equal(vagasDe(1, 10).texto, '1 vaga restante de 10')
assert.deepEqual(vagasDe(0, 8), { texto: 'Vagas esgotadas (8 de 8)', percentualOcupado: 100, esgotada: true })
assert.equal(vagasDe(null, null).percentualOcupado, null)
assert.equal(vagasDe(99, 10).percentualOcupado, 0)
assert.equal(textoPeriodo('2026-11-07T00:00:00.000Z', '2026-11-08T00:00:00.000Z'), '07/11/2026 a 08/11/2026')
assert.equal(textoPeriodo('2026-11-07', '2026-11-07'), '07/11/2026')
assert.equal(textoPeriodo(null, null), 'Datas a definir')
assert.equal(hrefParticipar('a b'), '/meu-time/campeonatos?categoria=a%20b')

// vazio útil
assert.equal(textoVazio(vazios).limpar, true)
assert.equal(textoVazio({ ...vazios, abertas: false }).limpar, false)

// normalização do servidor
const lista = normalizarCompeticoes({
  total: 41,
  itens: [
    { ligaId: 1, categoriaId: 'c1', campeonato: 'Copa', organizador: 'Org', categoria: 'Adulto', naipe: 'MISTO', cidade: 'Recife', local: 'Ginásio', inicio: '2026-11-07', fim: '2026-11-08', prazoInscricao: '2026-11-01', vagasTotal: 12, vagasRestantes: 3, valorInscricao: 0, modo: 'AUTOMATICA', situacao: 'DISPONIVEL', selo: { nivel: 'AVISO', texto: 'Atenção', detalhes: ['Falta 1 atleta', 5, ''] } },
    { categoriaId: '' },
    { categoriaId: 'c2', modo: 'xx', selo: { nivel: 'INVALIDO' } },
  ],
})
assert.equal(lista.itens.length, 2)
assert.equal(lista.total, 41)
assert.equal(lista.itens[0].ligaId, '1')
assert.equal(lista.itens[0].modo, 'AUTOMATICA')
assert.deepEqual(lista.itens[0].selo, { nivel: 'AVISO', texto: 'Atenção', detalhes: ['Falta 1 atleta'] })
assert.equal(lista.itens[1].modo, 'APROVACAO')
assert.equal(lista.itens[1].selo, null)
assert.deepEqual(normalizarCompeticoes(null), { itens: [], total: 0 })
assert.equal(normalizarCompeticoes({ itens: [{ categoriaId: 'a' }], total: 0 }).total, 1)

// status da inscrição
assert.equal(descreverStatus({ status: 'EM_ANALISE' }).etapa, 'EM_ANALISE')
const ajuste = descreverStatus({ status: 'AJUSTE_PEDIDO', comentario: ' Envie o RG do atleta 7 ' })
assert.equal(ajuste.etapa, 'PENDENCIA')
assert.match(ajuste.explicacao, /Envie o RG do atleta 7/)
assert.match(ajuste.proximoPasso, /responda/)
assert.match(descreverStatus({ status: 'LISTA_ESPERA', posicaoEspera: 4 }).explicacao, /posição 4/)
assert.equal(textoPosicaoEspera(null), 'Você está na lista de espera.')
assert.equal(textoPosicaoEspera(0), 'Você está na lista de espera.')
assert.match(descreverStatus({ status: 'RECUSADA', motivoRecusa: 'Sem vaga' }).explicacao, /Sem vaga/)
assert.match(descreverStatus({ status: 'RECUSADA' }).explicacao, /não informou/)
assert.equal(descreverStatus({ status: 'CONFIRMADA' }).tom, 'ok')
assert.equal(descreverStatus({ status: 'CONFIRMADA_COM_PENDENCIAS' }).tom, 'aviso')
assert.equal(descreverStatus({ status: 'REMOVIDA' }).tom, 'erro')
assert.equal(descreverStatus({ status: 'INVENTADO' }).rotulo, 'Situação em atualização')
const em = descreverStatus({ status: 'EM_ANALISE' })
assert.equal(estadoDaEtapa(em, 'RASCUNHO'), 'concluida')
assert.equal(estadoDaEtapa(em, 'EM_ANALISE'), 'atual')
assert.equal(estadoDaEtapa(em, 'DECISAO'), 'futura')
assert.equal(podeResponder('AJUSTE_PEDIDO'), true)
assert.equal(podeResponder('EM_ANALISE'), false)

// comentários
assert.equal(prepararComentario('   '), null)
assert.equal(prepararComentario('  oi  '), 'oi')
assert.equal(prepararComentario('a'.repeat(900))?.length, 500)
const coms = normalizarComentarios([{ id: 1, autor: 'ORGANIZADOR', mensagem: 'Falta RG', criadoEm: '2026-10-20T10:00:00Z' }, { mensagem: 'ok' }, { mensagem: ' ' }])
assert.equal(coms.length, 2)
assert.equal(coms[0].autor, 'ORGANIZADOR')
assert.equal(coms[1].autor, 'LIDER')
assert.deepEqual(normalizarComentarios(null), [])

// cliente: URL, método e envelope
async function cliente() {
  const chamadas: { url: string; init?: RequestInit }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    if (url.startsWith('/api/meu-time/competicoes')) return new Response(JSON.stringify({ data: { itens: [{ categoriaId: 'x' }], total: 1 } }), { status: 200 })
    if (init?.method === 'POST') return new Response(JSON.stringify({ data: {} }), { status: 201 })
    if (url.includes('/erro')) return new Response(JSON.stringify({ error: 'Não encontrado.' }), { status: 404 })
    return new Response(JSON.stringify({ data: [{ id: 'k', autor: 'ORGANIZADOR', mensagem: 'oi' }] }), { status: 200 })
  }) as unknown as typeof fetch
  const api = criarClienteCompeticoes(f)
  const r = await api.listar({ ...filtrosVazios(), cidade: 'Natal' })
  assert.equal(r.itens.length, 1)
  assert.equal(chamadas[0].url, '/api/meu-time/competicoes?cidade=Natal&abertas=1')
  assert.equal((await api.listarComentarios('i 1'))[0].mensagem, 'oi')
  assert.equal(chamadas[1].url, '/api/meu-time/inscricoes/i%201/comentarios')
  await api.comentar('i1', 'feito')
  assert.equal(chamadas[2].init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(chamadas[2].init?.body)), { mensagem: 'feito' })
  await assert.rejects(api.listarComentarios('erro/'), (e: unknown) => (e as { falha?: { tipo?: string } }).falha?.tipo === 'nao-habilitado')
}

cliente().then(
  () => console.log('meu-time-competicoes-ui: ok'),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
