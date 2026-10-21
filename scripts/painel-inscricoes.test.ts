// Painel de inscrições do organizador (R18): listagem sem PII, detalhe, decisões e transições (409), vagas e lista de
// espera com promoção automática, lote, exportação CSV segura, conversa de correção com o líder, equipe da organização
// (papéis), IDOR entre organizadores, flag desligada (404) e 503 sem as tabelas das migrations pendentes.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-painel-com-32-caracteres-ok'

const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const C1 = uuid(1) // liga 1, sem limite
const C2 = uuid(2) // liga 1, limite de 2 equipes
const C3 = uuid(3) // liga 2 (org-2)
const C4 = uuid(4) // liga 3 finalizada (org-1)
const T = [uuid(5), uuid(6), uuid(7), uuid(8), uuid(9)] // times 0..4
const I = Array.from({ length: 12 }, (_, i) => `a${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`)
const ORG_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function tabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}): Record<string, LinhaEscrita[]> {
  const insc = (n: number, timeId: string, categoria: string, ligaId: number, status: string, extras: Record<string, unknown> = {}) => ({
    id: I[n], ligaId, categoriaCampeonatoId: categoria, timeId, status, criadoPor: `lider${T.indexOf(timeId)}`, criadoEm: `2026-01-0${n % 9 + 1}T10:00:00Z`, atualizadoEm: `2026-02-0${n % 9 + 1}T10:00:00Z`, posicaoEspera: null, ...extras,
  })
  const atleta = (inscricaoId: string, n: number, nome: string, extras: Record<string, unknown> = {}) => ({
    inscricaoId, ligaId: 1, categoriaCampeonatoId: C1, atletaId: `0000000${n}-0000-4000-8000-000000000000`, nomeSnapshot: nome, numero: n, capitao: n === 1, libero: false, documentosOk: n !== 2, ativo: true, ...extras,
  })
  return {
    Liga: [
      { id: 1, nome: 'Copa Norte', status: 'ATIVA', organizadorId: 'org-1', simulacao: false },
      { id: 2, nome: 'Copa Sul', status: 'ATIVA', organizadorId: 'org-2', simulacao: false },
      { id: 3, nome: 'Copa Antiga', status: 'FINALIZADO', organizadorId: 'org-1', simulacao: false },
    ],
    CategoriaCampeonato: [
      { id: C1, ligaId: 1, codigo: 'FEMININO', nome: 'Adulto Feminino', removidaEm: null },
      { id: C2, ligaId: 1, codigo: 'MASCULINO', nome: 'Adulto Masculino', removidaEm: null },
      { id: C3, ligaId: 2, codigo: 'FEMININO', nome: 'Livre Feminino', removidaEm: null },
      { id: C4, ligaId: 3, codigo: 'FEMININO', nome: 'Antiga Feminino', removidaEm: null },
    ],
    CategoriaConfiguracao: [{ categoriaCampeonatoId: C2, ligaId: 1, quantidadeEquipesMaxima: 2, quantidadeEquipes: null }],
    RegraElenco: [{ categoriaCampeonatoId: C1, atletasMin: 6, atletasMax: 14 }],
    TimeClube: [
      { id: T[0], clubeId: 'c0', nome: 'Equipe Alfa', cidade: 'Belém', naipe: 'FEMININO', arquivadoEm: null },
      { id: T[1], clubeId: 'c1', nome: '=HYPERLINK("http://x")', cidade: '+Manaus', naipe: 'MASCULINO', arquivadoEm: null },
      { id: T[2], clubeId: 'c2', nome: 'Equipe Gama', cidade: 'Santarém', naipe: 'MASCULINO', arquivadoEm: null },
      { id: T[3], clubeId: 'c3', nome: 'Equipe Delta', cidade: 'Macapá', naipe: 'MASCULINO', arquivadoEm: null },
      { id: T[4], clubeId: 'c4', nome: 'Equipe Épsilon', cidade: 'Palmas', naipe: 'FEMININO', arquivadoEm: null },
    ],
    MembroEquipe: [
      ...T.map((timeId, i) => ({ timeId, usuarioId: `lider${i}`, papel: 'RESPONSAVEL' })),
      { timeId: T[0], usuarioId: 'assist0', papel: 'ASSISTENTE' },
    ],
    Inscricao: [
      insc(0, T[0], C1, 1, 'CONFIRMADA_COM_PENDENCIAS'), // pendência: pede correção
      insc(1, T[1], C2, 1, 'CONFIRMADA'), // ocupa vaga de C2
      insc(2, T[2], C2, 1, 'CONFIRMADA'), // ocupa vaga de C2
      insc(3, T[3], C2, 1, 'EM_ANALISE'), // quer entrar em C2 lotada
      insc(4, T[4], C2, 1, 'EM_ANALISE'),
      insc(5, T[4], C3, 2, 'EM_ANALISE'), // outro organizador
      insc(6, T[0], C4, 3, 'EM_ANALISE'), // campeonato finalizado
      insc(7, T[3], C1, 1, 'REMOVIDA'),
      insc(8, T[2], C1, 1, 'RASCUNHO'),
    ],
    InscricaoAtleta: [
      atleta(I[0], 1, 'Maria Souza Lima'),
      atleta(I[0], 2, 'Joana Pereira da Silva'),
      atleta(I[0], 3, 'Ana'),
    ],
    InscricaoComissao: [{ inscricaoId: I[0], nomeSnapshot: 'Carlos Alberto Mendes', funcao: 'TECNICO' }],
    Atleta: [1, 2, 3].map((n) => ({ id: `0000000${n}-0000-4000-8000-000000000000`, nome: 'SEGREDO NOME', cpfHash: n === 1 ? 'hash-cpf' : null, fotoRostoPath: n === 1 ? 'x/foto.jpg' : null, documentoPath: null, dataNascimento: '1990-01-01' })),
    AtletaDocumento: [],
    ComentarioInscricao: [],
    Notificacao: [],
    Organizador: [{ id: ORG_UUID, nome: 'Org Um', legadoId: 'org-1' }],
    MembroOrganizador: [
      { organizadorId: ORG_UUID, usuarioId: 'adm', papel: 'ADMINISTRADOR', criadoEm: '2026-01-01T00:00:00Z' },
      { organizadorId: ORG_UUID, usuarioId: 'fin', papel: 'FINANCEIRO', criadoEm: '2026-01-01T00:00:00Z' },
    ],
    CandidaturaOrganizador: [
      { id: 'org-1', nome: 'Dona Um', email: 'dona@volei.space' },
      { id: 'adm', nome: 'Admin', email: 'admin@volei.space' },
      { id: 'fin', nome: 'Financeiro', email: 'fin@volei.space' },
      { id: 'novo', nome: 'Novo', email: 'novo@volei.space' },
      { id: 'arb', nome: 'Arb', email: 'arb@volei.space' },
    ],
    ...(extra as Record<string, LinhaEscrita[]>),
  }
}

function novoBanco(t: Record<string, LinhaEscrita[]>, opcoes: Record<string, unknown> = {}) {
  banco.atual = criarBancoEscrita(t, {
    unicos: { MembroOrganizador: [['organizadorId', 'usuarioId']], Organizador: [['legadoId']] },
    ...opcoes,
  })
}

function req(metodo: string, caminho: string, corpo?: unknown) {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
const json = async (r: Response) => (await r.json()) as any
const pid = (inscricaoId: string) => ({ params: Promise.resolve({ inscricaoId }) })

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { celulaCsv, montarCsv, nomeAbreviado, resolverAprovacao, transicaoValida } = await import('../src/lib/painel-inscricoes/regras')
  const como = async (userId: string, tipo: 'equipe' | 'organizador' | 'arbitro' = 'organizador') => {
    reiniciarCotas()
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const lista = await import('../src/app/api/organizador/inscricoes/route')
  const detalhe = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/route')
  const decidir = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/decidir/route')
  const lote = await import('../src/app/api/organizador/inscricoes/lote/route')
  const exportar = await import('../src/app/api/organizador/inscricoes/exportar/route')
  const equipe = await import('../src/app/api/organizador/equipe/route')
  const comentarios = await import('../src/app/api/meu-time/inscricoes/[id]/comentarios/route')

  const GET_LISTA = (q = '') => lista.GET(req('GET', `/api/organizador/inscricoes${q}`))
  const GET_DET = (id: string) => detalhe.GET(req('GET', `/x/${id}`), pid(id))
  const DECIDIR = (id: string, corpo: unknown) => decidir.POST(req('POST', `/x/${id}`, corpo), pid(id))
  const status = (t: Record<string, LinhaEscrita[]>, n: number) => t.Inscricao.find((l) => l.id === I[n])!.status
  const linha = (t: Record<string, LinhaEscrita[]>, n: number) => t.Inscricao.find((l) => l.id === I[n])!

  // --- 0. Regras puras ---------------------------------------------------------------------------------
  assert.equal(nomeAbreviado('Maria Souza Lima'), 'Maria L.')
  assert.equal(nomeAbreviado('Ana'), 'Ana')
  assert.equal(celulaCsv('=1+1'), "'=1+1")
  assert.equal(celulaCsv('+55'), "'+55")
  assert.equal(celulaCsv('-x'), "'-x")
  assert.equal(celulaCsv('@a'), "'@a")
  assert.equal(celulaCsv('a;b'), '"a;b"')
  assert.ok(montarCsv([]).startsWith('﻿equipe;cidade;categoria;status;nº atletas;pendências;atualizado em'))
  assert.equal(transicaoValida('APROVAR', 'REMOVIDA'), false)
  assert.equal(transicaoValida('ANALISAR', 'CONFIRMADA'), false)
  assert.deepEqual(resolverAprovacao('EM_ANALISE', 2, 2), { destino: 'LISTA_ESPERA' })
  assert.deepEqual(resolverAprovacao('EM_ANALISE', 1, 2), { destino: 'CONFIRMADA' })
  assert.deepEqual(resolverAprovacao('CONFIRMADA_COM_PENDENCIAS', 5, 2), { destino: 'CONFIRMADA' }, 'quem já ocupa vaga não perde')
  assert.deepEqual(resolverAprovacao('EM_ANALISE', 99, null), { destino: 'CONFIRMADA' }, 'sem limite')

  // --- 1. Flag desligada: 404 em tudo ------------------------------------------------------------------------
  process.env.MEU_TIME_ATIVO = '1'
  delete process.env.PAINEL_INSCRICOES_ATIVO
  novoBanco(tabelas())
  await como('org-1')
  assert.equal((await GET_LISTA()).status, 404)
  assert.equal((await GET_DET(I[0])).status, 404)
  assert.equal((await DECIDIR(I[0], { acao: 'APROVAR' })).status, 404)
  assert.equal((await lote.POST(req('POST', '/x', { ids: [I[0]], acao: 'APROVAR' }))).status, 404)
  assert.equal((await exportar.GET(req('GET', '/x'))).status, 404)
  assert.equal((await equipe.GET(req('GET', '/x'))).status, 404)
  await como('lider0', 'equipe')
  assert.equal((await comentarios.GET(req('GET', '/x'), { params: { id: I[0] } })).status, 404)
  assert.equal((await comentarios.POST(req('POST', '/x', { mensagem: 'oi' }), { params: { id: I[0] } })).status, 404)
  process.env.PAINEL_INSCRICOES_ATIVO = '1'

  // --- 2. Autenticação ----------------------------------------------------------------------------------------
  sessao.token = null
  assert.equal((await GET_LISTA()).status, 401)
  await como('lider0', 'equipe')
  assert.equal((await GET_LISTA()).status, 401, 'conta de equipe não entra nas rotas do organizador')
  await como('arb', 'arbitro')
  assert.equal((await GET_LISTA()).status, 401)

  // --- 3. Listagem sem PII e isolamento --------------------------------------------------------------------------
  let t = tabelas()
  novoBanco(t)
  await como('org-1')
  const l1 = await GET_LISTA()
  assert.equal(l1.status, 200)
  const corpo1 = await json(l1)
  // org-1 vê as ligas 1 e 3 (sem rascunho): 0,1,2,3,4,6,7 = 7 itens; a inscrição da liga 2 não aparece.
  assert.equal(corpo1.data.total, 7)
  assert.ok(!corpo1.data.itens.some((i: any) => i.id === I[5]), 'inscrição de outro organizador não aparece')
  assert.ok(!corpo1.data.itens.some((i: any) => i.id === I[8]), 'rascunho não vai para o organizador')
  const item0 = corpo1.data.itens.find((i: any) => i.id === I[0])
  assert.deepEqual(Object.keys(item0).sort(), ['atletas', 'atualizadoEm', 'campeonato', 'categoria', 'categoriaId', 'comentariosAbertos', 'equipe', 'id', 'ligaId', 'pendencias', 'status'])
  assert.deepEqual(item0.equipe, { id: T[0], nome: 'Equipe Alfa', cidade: 'Belém' })
  assert.equal(item0.atletas, 3)
  assert.ok(item0.pendencias.some((p: string) => p.includes('Faltam 3 atletas')), 'mínimo da regra de elenco')
  assert.ok(item0.pendencias.some((p: string) => p.includes('sem documento')))
  assert.ok(!JSON.stringify(corpo1).match(/SEGREDO|hash-cpf|Maria|1990/), 'sem PII')
  // Filtros.
  assert.equal((await json(await GET_LISTA('?status=EM_ANALISE'))).data.total, 3)
  assert.deepEqual(corpo1.data.contadores, { RASCUNHO: 0, CONFIRMADA: 2, CONFIRMADA_COM_PENDENCIAS: 1, AJUSTE_PEDIDO: 0, REMOVIDA: 1, EM_ANALISE: 3, LISTA_ESPERA: 0, RECUSADA: 1 })
  const comFiltro = await json(await GET_LISTA('?status=EM_ANALISE'))
  assert.equal(comFiltro.data.contadores.CONFIRMADA, 2, 'contadores ignoram o filtro de status')
  assert.equal((await json(await GET_LISTA('?status=RECUSADA'))).data.total, 1, 'RECUSADA = REMOVIDA')
  assert.equal((await json(await GET_LISTA(`?categoriaId=${C2}`))).data.total, 4)
  assert.equal((await json(await GET_LISTA('?q=gama'))).data.total, 1)
  assert.equal((await json(await GET_LISTA('?ligaId=1'))).data.total, 6)
  assert.equal((await GET_LISTA('?status=XPTO')).status, 422)
  assert.equal((await GET_LISTA('?pagina=0')).status, 422)
  assert.equal((await json(await GET_LISTA('?pagina=2'))).data.itens.length, 0)
  assert.equal((await GET_LISTA('?ligaId=2')).status, 404, 'IDOR: campeonato de outro organizador')
  await como('org-2')
  const l2 = await json(await GET_LISTA())
  assert.deepEqual(l2.data.itens.map((i: any) => i.id), [I[5]])
  assert.equal((await GET_LISTA('?ligaId=1')).status, 404)
  // Membro enxerga a organização da dona; estranho não.
  await como('fin')
  assert.equal((await json(await GET_LISTA())).data.total, 7)
  await como('desconhecido')
  assert.equal((await json(await GET_LISTA())).data.total, 0)
  // Sem a tabela de comentários a listagem segue (contagem zerada).
  const semCom = tabelas()
  delete (semCom as any).ComentarioInscricao
  novoBanco(semCom)
  await como('org-1')
  assert.equal((await GET_LISTA()).status, 200)

  // --- 4. Detalhe ------------------------------------------------------------------------------------------------------
  t = tabelas()
  t.ComentarioInscricao.push({ id: 'cm1', inscricaoId: I[0], tipo: 'NOTA', autorPapel: 'ORGANIZADOR', mensagem: 'nota', criadoEm: '2026-02-01T00:00:00Z', resolvidoEm: null, autor: 'org-1' })
  novoBanco(t)
  await como('org-1')
  const d = await GET_DET(I[0])
  assert.equal(d.status, 200)
  const dc = await json(d)
  assert.deepEqual(dc.data.atletas.map((a: any) => a.nome), ['Maria L.', 'Joana S.', 'Ana'])
  assert.deepEqual(dc.data.atletas[0], { nome: 'Maria L.', camisa: 1, capitao: true, libero: false, temFoto: true, temDocumento: true, temCpf: true })
  assert.equal(dc.data.atletas[1].temDocumento, false)
  assert.deepEqual(dc.data.comissao, [{ nome: 'Carlos M.', funcao: 'TECNICO' }])
  assert.equal(dc.data.comentarios.length, 1)
  assert.ok(!JSON.stringify(dc).match(/SEGREDO|hash-cpf|1990|Souza|Pereira|Mendes/), 'detalhe sem nome completo, CPF ou nascimento')
  assert.equal((await GET_DET(I[5])).status, 404, 'inscrição de outro organizador')
  assert.equal((await GET_DET('nao-e-uuid')).status, 404)
  assert.equal((await GET_DET(uuid(3))).status, 404)
  await como('org-2')
  assert.equal((await GET_DET(I[0])).status, 404)

  // --- 5. Decisões: papéis, validação, transições, idempotência ---------------------------------------------------
  t = tabelas()
  novoBanco(t)
  await como('fin')
  assert.equal((await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO', mensagem: 'x' })).status, 403, 'FINANCEIRO só lê')
  await como('org-2')
  assert.equal((await DECIDIR(I[0], { acao: 'APROVAR' })).status, 404, 'IDOR')
  assert.equal(status(t, 0), 'CONFIRMADA_COM_PENDENCIAS')
  await como('org-1')
  assert.equal((await DECIDIR(I[0], { acao: 'XPTO' })).status, 422)
  assert.equal((await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO' })).status, 422, 'correção exige mensagem')
  assert.equal((await DECIDIR(I[0], { acao: 'RECUSAR' })).status, 422, 'recusa exige motivo')
  assert.equal((await DECIDIR('nao-e-uuid', { acao: 'APROVAR' })).status, 404)

  // PEDIR_CORRECAO: cria comentário, muda o status e avisa o líder; repetir não duplica.
  const pc = await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO', mensagem: 'Enviar os documentos' })
  assert.equal(pc.status, 200)
  assert.equal((await json(pc)).data.status, 'AJUSTE_PEDIDO')
  assert.equal(status(t, 0), 'AJUSTE_PEDIDO')
  assert.equal(t.ComentarioInscricao.length, 1)
  assert.deepEqual({ tipo: t.ComentarioInscricao[0].tipo, autorPapel: t.ComentarioInscricao[0].autorPapel, mensagem: t.ComentarioInscricao[0].mensagem }, { tipo: 'CORRECAO', autorPapel: 'ORGANIZADOR', mensagem: 'Enviar os documentos' })
  assert.equal(t.Notificacao.filter((n) => n.usuarioId === 'lider0' && n.tipo === 'AJUSTE_PEDIDO').length, 1)
  assert.ok(!JSON.stringify(t.Notificacao[0].dados).includes('documentos'), 'dados da notificação só com ids')
  await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO', mensagem: 'Enviar os documentos' })
  assert.equal(t.ComentarioInscricao.length, 1, 'idempotente: mesmo pedido não duplica comentário')
  assert.equal(t.Notificacao.length, 1, 'idempotente: não notifica de novo')
  await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO', mensagem: 'Também a foto' })
  assert.equal(t.ComentarioInscricao.length, 2, 'mensagem nova vira novo comentário')

  // ANALISAR a partir de AJUSTE_PEDIDO, depois aprovar (sem limite em C1).
  assert.equal((await json(await DECIDIR(I[0], { acao: 'ANALISAR' }))).data.status, 'EM_ANALISE')
  const ap = await DECIDIR(I[0], { acao: 'APROVAR' })
  assert.equal((await json(ap)).data.status, 'CONFIRMADA')
  assert.ok(t.Notificacao.some((n) => n.tipo === 'INSCRICAO_APROVADA' && n.usuarioId === 'lider0'))
  const antes = t.Notificacao.length
  assert.equal((await DECIDIR(I[0], { acao: 'APROVAR' })).status, 200, 'aprovar de novo é idempotente')
  assert.equal(t.Notificacao.length, antes)

  // Transições inválidas = 409.
  for (const [n, acao] of [[7, 'APROVAR'], [7, 'ANALISAR'], [7, 'PEDIR_CORRECAO'], [8, 'APROVAR'], [8, 'RECUSAR'], [0, 'ANALISAR'], [1, 'ANALISAR'], [1, 'LISTA_ESPERA']] as Array<[number, string]>) {
    const r = await DECIDIR(I[n], { acao, mensagem: 'm' })
    assert.equal(r.status, 409, `${acao} em ${t.Inscricao[n].status}`)
    assert.equal((await json(r)).codigo, 'TRANSICAO_INVALIDA')
  }
  assert.equal((await DECIDIR(I[7], { acao: 'RECUSAR', mensagem: 'm' })).status, 200, 'recusar o que já foi recusado é idempotente')

  // Campeonato finalizado = 409, mesmo idempotente.
  const fin = await DECIDIR(I[6], { acao: 'APROVAR' })
  assert.equal(fin.status, 409)
  assert.equal((await json(fin)).codigo, 'CAMPEONATO_FINALIZADO')
  assert.equal(status(t, 6), 'EM_ANALISE')

  // --- 6. Vagas, lista de espera e promoção automática -----------------------------------------------------------------
  // C2 tem limite 2 e já 2 confirmadas (I1, I2). Aprovar I3 e I4 -> lista de espera 1 e 2.
  const w1 = await json(await DECIDIR(I[3], { acao: 'APROVAR' }))
  assert.deepEqual({ status: w1.data.status, posicaoEspera: w1.data.posicaoEspera }, { status: 'LISTA_ESPERA', posicaoEspera: 1 })
  const w2 = await json(await DECIDIR(I[4], { acao: 'APROVAR' }))
  assert.deepEqual({ status: w2.data.status, posicaoEspera: w2.data.posicaoEspera }, { status: 'LISTA_ESPERA', posicaoEspera: 2 })
  assert.ok(t.Notificacao.some((n) => n.tipo === 'INSCRICAO_LISTA_ESPERA' && n.usuarioId === 'lider3'))
  const emEspera = (await json(await GET_LISTA('?status=LISTA_ESPERA'))).data.itens
  assert.deepEqual(emEspera.map((i: any) => i.posicaoEspera).sort(), [1, 2])
  // Aprovar quem já está na fila e continua sem vaga: nada muda.
  assert.equal((await json(await DECIDIR(I[3], { acao: 'APROVAR' }))).data.status, 'LISTA_ESPERA')
  assert.equal(linha(t, 3).posicaoEspera, 1)
  // Uma confirmada é recusada: abre vaga e o primeiro da fila entra; o segundo vira o primeiro.
  const rec = await json(await DECIDIR(I[1], { acao: 'RECUSAR', mensagem: 'Documentação inválida' }))
  assert.equal(rec.data.status, 'REMOVIDA')
  assert.equal(rec.data.promovidas, 1)
  assert.equal(linha(t, 1).motivoDecisao, 'Documentação inválida')
  assert.equal(status(t, 3), 'CONFIRMADA')
  assert.equal(linha(t, 3).posicaoEspera, null)
  assert.equal(status(t, 4), 'LISTA_ESPERA')
  assert.equal(linha(t, 4).posicaoEspera, 1, 'fila renumerada')
  assert.ok(t.Notificacao.some((n) => n.tipo === 'INSCRICAO_PROMOVIDA' && n.usuarioId === 'lider3'), 'avisa quem foi promovido')
  assert.ok(t.Notificacao.some((n) => n.tipo === 'INSCRICAO_RECUSADA' && n.usuarioId === 'lider1'))
  // Pedir correção a uma confirmada também libera a vaga.
  const pcc = await json(await DECIDIR(I[2], { acao: 'PEDIR_CORRECAO', mensagem: 'Revisar lista' }))
  assert.equal(pcc.data.status, 'AJUSTE_PEDIDO')
  assert.equal(pcc.data.promovidas, 1)
  assert.equal(status(t, 4), 'CONFIRMADA')

  // --- 7. Lote -----------------------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  await como('org-1')
  assert.equal((await lote.POST(req('POST', '/x', { ids: [], acao: 'APROVAR' }))).status, 422)
  assert.equal((await lote.POST(req('POST', '/x', { ids: Array.from({ length: 51 }, (_, i) => uuid(i % 9 + 1)), acao: 'APROVAR' }))).status, 422, 'até 50')
  assert.equal((await lote.POST(req('POST', '/x', { ids: [I[3]], acao: 'RECUSAR' }))).status, 422, 'só APROVAR')
  const lt = await json(await lote.POST(req('POST', '/x', { ids: [I[3], I[4], I[5], I[7], I[0]], acao: 'APROVAR' })))
  assert.deepEqual(lt.data.aprovadas, [I[0]])
  assert.deepEqual(lt.data.listaEspera.map((l: any) => l.id), [I[3], I[4]])
  assert.equal(lt.data.falhas.length, 2)
  const porId = new Map<string, any>(lt.data.falhas.map((r: any) => [r.id, r]))
  assert.equal(porId.get(I[5]).codigo, 'INSCRICAO_NAO_ENCONTRADA', 'inscrição de outro organizador não é aprovada')
  assert.equal(porId.get(I[7]).codigo, 'TRANSICAO_INVALIDA')
  assert.equal(status(t, 5), 'EM_ANALISE')
  assert.equal(status(t, 3), 'LISTA_ESPERA', 'C2 já tem as 2 vagas ocupadas: o lote respeita o limite')
  assert.equal(status(t, 4), 'LISTA_ESPERA')
  assert.equal(status(t, 0), 'CONFIRMADA')
  await como('fin')
  const ltFin = await json(await lote.POST(req('POST', '/x', { ids: [I[3]], acao: 'APROVAR' })))
  assert.deepEqual(ltFin.data.aprovadas, [])
  assert.deepEqual(ltFin.data.falhas, [{ id: I[3], codigo: 'SEM_PERMISSAO' }], 'FINANCEIRO não aprova, nem em lote')

  // --- 8. Exportação -----------------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  await como('org-1')
  const ex = await exportar.GET(req('GET', '/api/organizador/inscricoes/exportar?ligaId=1'))
  assert.equal(ex.status, 200)
  assert.match(ex.headers.get('content-type') ?? '', /text\/csv; charset=utf-8/)
  assert.equal(ex.headers.get('x-esquema-csv'), 'inscricoes-v1')
  const bytes = Buffer.from(await ex.arrayBuffer())
  assert.deepEqual(Array.from(bytes.subarray(0, 3)), [0xef, 0xbb, 0xbf], 'BOM UTF-8')
  const csv = bytes.toString('utf8')
  assert.ok(csv.startsWith('﻿equipe;cidade;categoria;status;nº atletas;pendências;atualizado em\r\n'))
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`) || csv.includes(`'=HYPERLINK`), 'fórmula neutralizada')
  assert.ok(!/(^|;)=HYPERLINK/m.test(csv), 'nenhuma célula começa com =')
  assert.ok(csv.includes(`'+Manaus`), 'cidade com + neutralizada')
  assert.ok(!/SEGREDO|hash-cpf|Maria|1990|cpf|telefone/i.test(csv), 'sem CPF, telefone, documento ou nome de atleta')
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1 + 6, 'cabeçalho + 6 inscrições da liga 1 (sem rascunho)')
  assert.equal((await exportar.GET(req('GET', '/x?ligaId=2'))).status, 404, 'IDOR')
  assert.equal((await exportar.GET(req('GET', '/x?status=XPTO'))).status, 422)
  await como('fin')
  assert.equal((await exportar.GET(req('GET', '/x?ligaId=1'))).status, 200, 'FINANCEIRO pode exportar')

  // --- 9. Conversa de correção com o líder -------------------------------------------------------------------------------------
  t = tabelas()
  t.Inscricao[0].status = 'AJUSTE_PEDIDO'
  t.ComentarioInscricao.push({ id: 'cm1', inscricaoId: I[0], tipo: 'CORRECAO', autorPapel: 'ORGANIZADOR', mensagem: 'Enviar documentos', criadoEm: '2026-02-01T00:00:00Z', resolvidoEm: null, autor: 'org-1' })
  novoBanco(t)
  const C_GET = (id: string) => comentarios.GET(req('GET', `/x/${id}`), { params: { id } })
  const C_POST = (id: string, corpo: unknown) => comentarios.POST(req('POST', `/x/${id}`, corpo), { params: { id } })
  await como('lider1', 'equipe')
  assert.equal((await C_GET(I[0])).status, 404, 'equipe alheia = 404')
  assert.equal((await C_POST(I[0], { mensagem: 'oi' })).status, 404)
  await como('assist0', 'equipe')
  assert.equal((await C_GET(I[0])).status, 200, 'assistente lê')
  assert.equal((await C_POST(I[0], { mensagem: 'oi' })).status, 403, 'assistente não escreve')
  await como('lider0', 'equipe')
  const g = await json(await C_GET(I[0]))
  assert.equal(g.data.comentarios.length, 1)
  assert.equal((await C_POST(I[0], { mensagem: '   ' })).status, 422)
  assert.equal((await C_POST('nao-e-uuid', { mensagem: 'ok' })).status, 404)
  const resp = await C_POST(I[0], { mensagem: 'Documentos enviados' })
  assert.equal(resp.status, 201)
  assert.equal((await json(resp)).data.status, 'EM_ANALISE')
  assert.equal(status(t, 0), 'EM_ANALISE')
  assert.equal(t.ComentarioInscricao.length, 2)
  assert.equal(t.ComentarioInscricao[0].resolvidoEm != null, true, 'correção aberta fica respondida')
  assert.deepEqual({ tipo: t.ComentarioInscricao[1].tipo, autorPapel: t.ComentarioInscricao[1].autorPapel }, { tipo: 'RESPOSTA', autorPapel: 'LIDER' })
  assert.ok(t.Notificacao.some((n) => n.tipo === 'INSCRICAO_RESPOSTA' && n.usuarioId === 'org-1'), 'organizador é notificado')
  // Inscrição recusada, rascunho e campeonato finalizado: 409.
  await como('lider3', 'equipe')
  assert.equal((await C_POST(I[7], { mensagem: 'oi' })).status, 409)
  await como('lider2', 'equipe')
  assert.equal((await C_POST(I[8], { mensagem: 'oi' })).status, 409)
  await como('lider0', 'equipe')
  assert.equal((await C_POST(I[6], { mensagem: 'oi' })).status, 409)

  // --- 10. Equipe da organização --------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  const EQ_POST = (corpo: unknown) => equipe.POST(req('POST', '/x', corpo))
  const EQ_DEL = (corpo: unknown) => equipe.DELETE(req('DELETE', '/x', corpo))
  await como('org-1')
  const eq = await json(await equipe.GET(req('GET', '/x')))
  assert.equal(eq.data.meuPapel, 'DONO')
  assert.deepEqual(eq.data.membros.map((m: any) => m.papel), ['ADMINISTRADOR', 'FINANCEIRO'])
  assert.deepEqual(eq.data.membros[0], { email: 'admin@volei.space', papel: 'ADMINISTRADOR', nome: 'Admin', status: 'ATIVO' }, 'quem gerencia vê o e-mail')
  await como('fin')
  const eqFin = await json(await equipe.GET(req('GET', '/x')))
  assert.equal(eqFin.data.meuPapel, 'FINANCEIRO')
  assert.ok(!JSON.stringify(eqFin).includes('admin@volei.space'), 'quem só lê vê o e-mail mascarado')
  await como('org-1')
  assert.equal((await EQ_POST({ email: 'x', papel: 'FINANCEIRO' })).status, 422)
  assert.equal((await EQ_POST({ email: 'novo@volei.space', papel: 'DONO' })).status, 422)
  const add = await json(await EQ_POST({ email: 'novo@volei.space', papel: 'ARBITRAGEM' }))
  const addInexistente = await json(await EQ_POST({ email: 'ninguem@volei.space', papel: 'ARBITRAGEM' }))
  assert.deepEqual(add, addInexistente, 'resposta uniforme: não revela se o e-mail tem conta')
  assert.equal(t.MembroOrganizador.filter((m) => m.usuarioId === 'novo' && m.papel === 'ARBITRAGEM').length, 1)
  await EQ_POST({ email: 'novo@volei.space', papel: 'ARBITRAGEM' })
  assert.equal(t.MembroOrganizador.filter((m) => m.usuarioId === 'novo').length, 1, 'idempotente')
  // O novo membro lê o painel, mas não decide.
  await como('novo')
  assert.equal((await json(await GET_LISTA())).data.total, 7)
  assert.equal((await DECIDIR(I[3], { acao: 'ANALISAR' })).status, 403)
  assert.equal((await EQ_POST({ email: 'arb@volei.space', papel: 'ARBITRAGEM' })).status, 403, 'ARBITRAGEM só lê')
  assert.equal((await EQ_DEL({ email: 'fin@volei.space' })).status, 403)
  // ADMINISTRADOR gerencia, mas não concede nem retira ADMINISTRADOR.
  await como('adm')
  assert.equal((await EQ_POST({ email: 'arb@volei.space', papel: 'FINANCEIRO' })).status, 200)
  assert.equal((await EQ_POST({ email: 'arb@volei.space', papel: 'ADMINISTRADOR' })).status, 403)
  assert.equal((await EQ_DEL({ email: 'admin@volei.space' })).status, 403)
  assert.equal((await DECIDIR(I[3], { acao: 'ANALISAR' })).status, 200, 'ADMINISTRADOR decide')
  assert.equal((await EQ_DEL({ email: 'arb@volei.space' })).status, 200)
  assert.equal((await EQ_DEL({ email: 'arb@volei.space' })).status, 404)
  // Outro organizador não mexe na equipe de org-1: a dele é outra.
  await como('org-2')
  const outra = await json(await equipe.GET(req('GET', '/x')))
  assert.deepEqual(outra.data.membros, [])
  await EQ_POST({ email: 'arb@volei.space', papel: 'FINANCEIRO' })
  assert.equal(t.Organizador.length, 2, 'cria a organização do dono na primeira escrita')
  assert.equal(t.MembroOrganizador.some((m) => m.usuarioId === 'arb' && m.organizadorId === ORG_UUID), false)
  await como('org-1')
  assert.equal((await EQ_DEL({ email: 'novo@volei.space' })).status, 200)
  assert.equal(t.MembroOrganizador.some((m) => m.usuarioId === 'novo'), false)

  // --- 11. 503 sem as tabelas das migrations pendentes --------------------------------------------------------------------------------
  const semComentario = tabelas()
  delete (semComentario as any).ComentarioInscricao
  novoBanco(semComentario)
  await como('org-1')
  const s503 = await DECIDIR(I[0], { acao: 'PEDIR_CORRECAO', mensagem: 'x' })
  assert.equal(s503.status, 503)
  assert.equal((await json(s503)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal(status(semComentario, 0), 'CONFIRMADA_COM_PENDENCIAS', 'sem o comentário a decisão não vale')
  assert.equal((await GET_DET(I[0])).status, 200, 'detalhe tolera a falta da tabela')
  const semFila = tabelas()
  novoBanco(semFila, { colunasAusentes: { Inscricao: ['posicaoEspera'] } })
  await como('org-1')
  const f503 = await DECIDIR(I[3], { acao: 'APROVAR' })
  assert.equal(f503.status, 503, 'sem a coluna posicaoEspera a lista de espera não existe')
  assert.equal(status(semFila, 3), 'EM_ANALISE')
  const semOrg = tabelas()
  delete (semOrg as any).Organizador
  delete (semOrg as any).MembroOrganizador
  novoBanco(semOrg)
  await como('org-1')
  assert.equal((await GET_LISTA()).status, 200, 'dono segue sem as tabelas da organização')
  assert.equal((await equipe.GET(req('GET', '/x'))).status, 503)
  assert.equal((await EQ_POST({ email: 'novo@volei.space', papel: 'FINANCEIRO' })).status, 503)
  await como('fin')
  assert.equal((await json(await GET_LISTA())).data.total, 0, 'membro sem tabela de organização não enxerga nada')

  console.log('painel-inscricoes.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
