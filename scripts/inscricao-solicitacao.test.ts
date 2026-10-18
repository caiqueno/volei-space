// Solicitação de inscrição (R14): vitrine do líder, modo AUTOMATICA x APROVACAO, fila e decisão do organizador,
// notificações, isolamento entre organizadores e entre equipes, flags e 503 sem as migrations pendentes.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-solicitacao-com-32-caracteres'

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
const C1 = uuid(1) // liga 1, feminina, AUTOMATICA (org-1)
const C2 = uuid(2) // liga 1, masculina
const C3 = uuid(3) // liga 2, feminina, APROVACAO (org-2)
const C4 = uuid(4) // liga 3 privada, feminina, com link
const C5 = uuid(5) // liga 4 em rascunho
const C6 = uuid(6) // liga 5 com inscrições fechadas
const C7 = uuid(7) // liga 2, feminina, APROVACAO (org-2)
const EQ = uuid(8)
const EQ_OUTRA = uuid(9)
const CLUBE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLUBE_OUTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOTIF_ALHEIA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function tabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}): Record<string, LinhaEscrita[]> {
  const atletas = Array.from({ length: 6 }, (_, i) => ({
    id: `0000000${i + 1}-0000-4000-8000-000000000000`,
    nome: `Atleta Secreto ${i + 1}`,
    dataNascimento: `199${i}-05-1${i}`,
    sexo: 'F',
    numeroPreferido: i === 5 ? null : i === 4 ? 1 : i + 1, // repetido (1) e ausente: o servidor numera
    cpfHash: 'cpf-secreto',
    mescladoParaId: null,
  }))
  const liga = (id: number, nome: string, organizadorId: string, extras: Record<string, unknown> = {}) => ({
    id, nome, organizadorId, status: 'ATIVA', simulacao: false, inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null, ...extras,
  })
  const categoria = (id: string, ligaId: number, codigo: string, nome: string, extras: Record<string, unknown> = {}) => ({
    id, ligaId, codigo, nome, ordem: 0, tokenInscricao: null, removidaEm: null, ...extras,
  })
  return {
    Liga: [
      liga(1, 'Copa Norte', 'org-1'),
      liga(2, 'Copa Sul', 'org-2'),
      liga(3, 'Copa Privada', 'org-1', { visibilidade: 'PRIVADA' }),
      liga(4, 'Copa Rascunho', 'org-1', { status: 'RASCUNHO' }),
      liga(5, 'Copa Fechada', 'org-1', { inscricoesAbertas: false }),
    ],
    CategoriaCampeonato: [
      categoria(C1, 1, 'FEMININO', 'Adulto Feminino'),
      categoria(C2, 1, 'MASCULINO', 'Adulto Masculino'),
      categoria(C3, 2, 'FEMININO', 'Livre Feminino', { modoInscricao: 'APROVACAO' }),
      categoria(C4, 3, 'FEMININO', 'Privada Feminina', { tokenInscricao: 'tok-priv' }),
      categoria(C5, 4, 'FEMININO', 'Rascunho Feminino'),
      categoria(C6, 5, 'FEMININO', 'Fechada Feminina'),
      categoria(C7, 2, 'FEMININO', 'Sub-19 Feminino', { modoInscricao: 'APROVACAO' }),
    ],
    CategoriaConfiguracao: [C1, C3, C4, C6, C7].map((id) => ({ categoriaCampeonatoId: id, ligaId: 1, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null })),
    RegraElenco: [], LinkInscricaoCampeonato: [], ConviteEquipe: [],
    Clube: [{ id: CLUBE, nome: 'Clube A' }, { id: CLUBE_OUTRO, nome: 'Clube B' }],
    TimeClube: [
      { id: EQ, clubeId: CLUBE, nome: 'Equipe A', cidade: 'Belém', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
      { id: EQ_OUTRA, clubeId: CLUBE_OUTRO, nome: 'Equipe B', cidade: 'Manaus', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
    ],
    MembroEquipe: [
      { timeId: EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' },
      { timeId: EQ, usuarioId: 'tecnico', papel: 'TECNICO' },
      { timeId: EQ, usuarioId: 'assist', papel: 'ASSISTENTE' },
      { timeId: EQ_OUTRA, usuarioId: 'outro', papel: 'RESPONSAVEL' },
    ],
    Atleta: atletas,
    VinculoAtletaClube: atletas.map((a) => ({ clubeId: CLUBE, atletaId: a.id, status: 'ATIVO' })),
    AtletaConsentimento: [],
    Inscricao: [], InscricaoAtleta: [], InscricaoComissao: [], ComissaoTime: [],
    SolicitacaoInscricao: [],
    Notificacao: [{ id: NOTIF_ALHEIA, usuarioId: 'org-2', tipo: 'X', titulo: 't', mensagem: 'm', dados: null, lidaEm: null, criadoEm: '2026-01-01T00:00:00Z' }],
    ...(extra as Record<string, LinhaEscrita[]>),
  }
}

function novoBanco(t: Record<string, LinhaEscrita[]>, opcoes: Record<string, unknown> = {}) {
  banco.atual = criarBancoEscrita(t, {
    unicos: { Inscricao: [['categoriaCampeonatoId', 'timeId']], MembroEquipe: [['timeId', 'usuarioId']] },
    padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, capitao: false, libero: false } },
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

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const como = async (userId: string, tipo: 'equipe' | 'organizador' | 'arbitro' = 'equipe') => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const vitrine = await import('../src/app/api/meu-time/campeonatos/route')
  const solicitar = await import('../src/app/api/meu-time/campeonatos/solicitacoes/route')
  const cancelar = await import('../src/app/api/meu-time/campeonatos/solicitacoes/[id]/route')
  const lista = await import('../src/app/api/organizador/solicitacoes/route')
  const decidir = await import('../src/app/api/organizador/solicitacoes/[id]/decidir/route')
  const modo = await import('../src/app/api/organizador/categorias/[id]/inscricao/route')
  const notifs = await import('../src/app/api/organizador/notificacoes/route')
  const lida = await import('../src/app/api/organizador/notificacoes/[id]/lida/route')

  const GET_VITRINE = (equipeId = EQ) => vitrine.GET(req('GET', `/api/meu-time/campeonatos?equipeId=${equipeId}`))
  const POST_SOLIC = (corpo: unknown) => solicitar.POST(req('POST', '/api/meu-time/campeonatos/solicitacoes', corpo))
  const DEL_SOLIC = (id: string) => cancelar.DELETE(req('DELETE', `/x/${id}`), { params: { id } })
  const GET_LISTA = (consulta = '') => lista.GET(req('GET', `/api/organizador/solicitacoes${consulta}`))
  const POST_DECIDIR = (id: string, corpo: unknown) => decidir.POST(req('POST', `/x/${id}`, corpo), { params: Promise.resolve({ id }) })
  const solic = (equipeId: string, categoriaId: string, extra: Record<string, unknown> = {}) => ({ equipeId, categoriaId, ...extra })

  // --- 1. Flag desligada: 404 em tudo, mesmo logado -------------------------------------------------
  process.env.MEU_TIME_ATIVO = '1'
  delete process.env.INSCRICAO_SOLICITACAO_ATIVO
  novoBanco(tabelas())
  await como('lider')
  assert.equal((await GET_VITRINE()).status, 404)
  assert.equal((await POST_SOLIC(solic(EQ, C1))).status, 404)
  assert.equal((await DEL_SOLIC(uuid(7))).status, 404)
  await como('org-1', 'organizador')
  assert.equal((await GET_LISTA()).status, 404)
  assert.equal((await POST_DECIDIR(uuid(7), { decisao: 'APROVADA' })).status, 404)
  assert.equal((await modo.GET(req('GET', '/x'), { params: Promise.resolve({ id: C1 }) })).status, 404)
  assert.equal((await modo.PUT(req('PUT', '/x', { modoInscricao: 'APROVACAO' }), { params: Promise.resolve({ id: C1 }) })).status, 404)
  assert.equal((await notifs.GET(req('GET', '/x'))).status, 404)
  assert.equal((await lida.POST(req('POST', '/x'), { params: Promise.resolve({ id: NOTIF_ALHEIA }) })).status, 404)

  // Flag das solicitações ligada, Meu Time desligado: líder segue 404.
  process.env.INSCRICAO_SOLICITACAO_ATIVO = '1'
  delete process.env.MEU_TIME_ATIVO
  await como('lider')
  assert.equal((await GET_VITRINE()).status, 404)
  process.env.MEU_TIME_ATIVO = '1'

  // --- 2. Autenticação ----------------------------------------------------------------------------
  sessao.token = null
  assert.equal((await GET_VITRINE()).status, 401)
  await como('arb', 'arbitro')
  assert.equal((await GET_VITRINE()).status, 401)
  assert.equal((await GET_LISTA()).status, 401)
  await como('lider')
  assert.equal((await GET_LISTA()).status, 401, 'conta de equipe não entra nas rotas do organizador')

  // --- 3. Vitrine do líder -------------------------------------------------------------------------
  const t = tabelas()
  novoBanco(t)
  await como('lider')
  const v1 = await GET_VITRINE()
  assert.equal(v1.status, 200)
  const linhas = (await json(v1)).data as any[]
  assert.deepEqual(linhas.map((l) => l.categoriaId).sort(), [C1, C3, C7].sort(), 'só abertas, publicadas, públicas e do naipe da equipe')
  const l1 = linhas.find((l) => l.categoriaId === C1)
  assert.deepEqual(l1, { ligaId: 1, categoriaId: C1, campeonato: 'Copa Norte', categoria: 'Adulto Feminino', naipe: 'FEMININO', modo: 'AUTOMATICA', situacao: 'DISPONIVEL' })
  assert.equal(linhas.find((l) => l.categoriaId === C3).modo, 'APROVACAO')
  assert.ok(!JSON.stringify(linhas).includes('tok-priv') && !JSON.stringify(linhas).includes('tokenInscricao'), 'nunca devolve token')
  // Papéis e posse.
  await como('tecnico')
  assert.equal((await GET_VITRINE()).status, 200, 'TECNICO também vê')
  await como('assist')
  assert.equal((await GET_VITRINE()).status, 403, 'ASSISTENTE não')
  await como('outro')
  assert.equal((await GET_VITRINE(EQ)).status, 404, 'equipe alheia = 404')
  assert.equal((await GET_VITRINE('nao-e-uuid')).status, 404)
  await como('lider')
  // Privada só com convite do organizador.
  t.ConviteEquipe.push({ id: 'cv1', ligaId: 3, email: 'x@y.z', status: 'ENVIADO', candidaturaEquipeId: 'lider' })
  const comConvite = ((await json(await GET_VITRINE())).data as any[]).map((l) => l.categoriaId)
  assert.ok(comConvite.includes(C4), 'privada aparece para a equipe convidada')
  t.ConviteEquipe.length = 0

  // --- 4. POST: validações ---------------------------------------------------------------------------
  reiniciarCotas()
  assert.equal((await POST_SOLIC({})).status, 422)
  assert.equal((await POST_SOLIC(solic('x', C1))).status, 422)
  assert.equal((await POST_SOLIC(solic(EQ, uuid(8)))).status, 404, 'categoria inexistente')
  assert.equal((await POST_SOLIC(solic(EQ, C2))).status, 422, 'naipe incompatível')
  assert.equal((await json(await POST_SOLIC(solic(EQ, C2)))).codigo, 'NAIPE_INCOMPATIVEL')
  assert.equal((await POST_SOLIC(solic(EQ, C5))).status, 404, 'campeonato em rascunho não existe para o líder')
  const fechada = await POST_SOLIC(solic(EQ, C6))
  assert.equal(fechada.status, 403)
  assert.equal((await json(fechada)).codigo, 'INSCRICOES_FECHADAS')
  const semConvite = await POST_SOLIC(solic(EQ, C4))
  assert.equal(semConvite.status, 403)
  assert.equal((await json(semConvite)).codigo, 'CONVITE_OBRIGATORIO')
  const convBad = await POST_SOLIC(solic(EQ, C4, { convite: 'errado' }))
  assert.equal(convBad.status, 403)
  assert.equal((await json(convBad)).codigo, 'CONVITE_INVALIDO')
  await como('assist')
  assert.equal((await POST_SOLIC(solic(EQ, C1))).status, 403)
  await como('outro')
  assert.equal((await POST_SOLIC(solic(EQ, C1))).status, 404, 'IDOR: equipe de outro = 404')
  assert.equal(t.Inscricao.length, 0)
  // Equipe sem atletas.
  assert.equal((await POST_SOLIC(solic(EQ_OUTRA, C1))).status, 422)
  assert.equal((await json(await POST_SOLIC(solic(EQ_OUTRA, C3)))).codigo, 'TIME_SEM_ATLETAS')
  assert.equal(t.SolicitacaoInscricao.length, 0)

  // --- 5. Modo AUTOMATICA: inscreve direto pelo caminho existente --------------------------------------------
  await como('lider')
  const auto = await POST_SOLIC(solic(EQ, C1, { mensagem: 'queremos jogar' }))
  assert.equal(auto.status, 201)
  const corpoAuto = await json(auto)
  assert.equal(corpoAuto.data.estado, 'INSCRITA')
  assert.equal(t.Inscricao.length, 1)
  assert.equal(t.Inscricao[0].status, 'CONFIRMADA', 'status da inscrição do Meu Time (não cria fila)')
  assert.equal(t.Inscricao[0].timeId, EQ)
  assert.equal(t.InscricaoAtleta.length, 6, 'copia o banco de atletas')
  assert.equal(new Set(t.InscricaoAtleta.map((a) => a.numero)).size, 6, 'camisas distintas mesmo com preferência repetida')
  assert.equal(t.SolicitacaoInscricao.length, 0, 'AUTOMATICA não cria solicitação')
  const dup = await POST_SOLIC(solic(EQ, C1))
  assert.equal(dup.status, 409)
  assert.equal((await json(dup)).codigo, 'JA_INSCRITA')
  assert.equal(t.Inscricao.length, 1)
  assert.equal(((await json(await GET_VITRINE())).data as any[]).find((l) => l.categoriaId === C1).situacao, 'INSCRITA')
  // Privada com o token do link (convite) entra direto.
  const priv = await POST_SOLIC(solic(EQ, C4, { convite: 'tok-priv' }))
  assert.equal(priv.status, 201)
  assert.equal(t.Inscricao.length, 2)

  // --- 6. Modo APROVACAO: fila + notificação ao organizador -----------------------------------------------------
  const pend = await POST_SOLIC(solic(EQ, C3, { mensagem: 'Podemos entrar?' }))
  assert.equal(pend.status, 201)
  const pendCorpo = (await json(pend)).data
  assert.equal(pendCorpo.estado, 'PENDENTE')
  const solId = pendCorpo.id as string
  assert.equal(t.Inscricao.length, 2, 'APROVACAO não cria inscrição')
  const notifOrg = t.Notificacao.filter((n) => n.usuarioId === 'org-2' && n.tipo === 'SOLICITACAO_INSCRICAO')
  assert.equal(notifOrg.length, 1, 'o dono da liga é avisado')
  assert.deepEqual(notifOrg[0].dados, { solicitacaoId: solId, equipe: 'Equipe A', categoria: 'Livre Feminino' })
  const dupP = await POST_SOLIC(solic(EQ, C3))
  assert.equal(dupP.status, 409)
  assert.equal((await json(dupP)).codigo, 'SOLICITACAO_PENDENTE')
  assert.equal(t.SolicitacaoInscricao.length, 1)
  const vp = ((await json(await GET_VITRINE())).data as any[]).find((l) => l.categoriaId === C3)
  assert.equal(vp.situacao, 'PENDENTE')
  assert.equal(vp.solicitacaoId, solId)

  // --- 7. Organizador: isolamento --------------------------------------------------------------------------------------
  await como('org-1', 'organizador')
  const vazio = await GET_LISTA()
  assert.equal(vazio.status, 200)
  assert.deepEqual((await json(vazio)).data, [], 'org-1 não vê solicitação de liga alheia')
  assert.equal((await GET_LISTA('?ligaId=2')).status, 404, 'ligaId alheio = 404')
  assert.equal((await POST_DECIDIR(solId, { decisao: 'APROVADA' })).status, 404, 'IDOR ao decidir = 404')
  assert.equal(t.SolicitacaoInscricao[0].estado, 'PENDENTE')
  await como('org-2', 'organizador')
  const minha = await GET_LISTA()
  assert.equal(minha.status, 200)
  const itens = (await json(minha)).data as any[]
  assert.equal(itens.length, 1)
  assert.deepEqual(Object.keys(itens[0]).sort(), ['atletas', 'campeonato', 'categoria', 'equipe', 'estado', 'id', 'inscricaoId', 'ligaId', 'mensagem', 'motivoRecusa', 'solicitadoEm'])
  assert.deepEqual(itens[0].equipe, { id: EQ, nome: 'Equipe A', cidade: 'Belém' })
  assert.equal(itens[0].atletas, 6)
  assert.equal(itens[0].campeonato, 'Copa Sul')
  assert.equal(itens[0].categoria, 'Livre Feminino')
  assert.equal(itens[0].mensagem, 'Podemos entrar?')
  const bruto = JSON.stringify(itens)
  assert.ok(!/Secreto|cpf-secreto|dataNascimento|nascimento/i.test(bruto), 'sem PII de atletas')
  assert.equal((await json(await GET_LISTA('?estado=PENDENTE'))).data.length, 1)
  assert.equal((await json(await GET_LISTA('?estado=APROVADA'))).data.length, 0)
  assert.equal((await GET_LISTA('?estado=QUALQUER')).status, 422)
  assert.equal((await GET_LISTA('?ligaId=2')).status, 200)
  assert.equal((await GET_LISTA('?ligaId=abc')).status, 404)

  // --- 8. Decisão: recusa, idempotência, contrária ---------------------------------------------------------------------------
  assert.equal((await POST_DECIDIR(solId, { decisao: 'TALVEZ' })).status, 422)
  assert.equal((await POST_DECIDIR('nao-uuid', { decisao: 'APROVADA' })).status, 404)
  const rec = await POST_DECIDIR(solId, { decisao: 'RECUSADA', motivo: 'Vagas esgotadas' })
  assert.equal(rec.status, 200)
  assert.equal((await json(rec)).data.estado, 'RECUSADA')
  assert.equal(t.SolicitacaoInscricao[0].motivoRecusa, 'Vagas esgotadas')
  assert.equal(t.SolicitacaoInscricao[0].decididoPor, 'org-2')
  const nrec = t.Notificacao.filter((n) => n.usuarioId === 'lider' && n.tipo === 'SOLICITACAO_RECUSADA')
  assert.equal(nrec.length, 1)
  assert.ok(String(nrec[0].mensagem).includes('Vagas esgotadas'), 'o motivo vai na notificação do líder')
  assert.equal((await POST_DECIDIR(solId, { decisao: 'RECUSADA', motivo: 'Vagas esgotadas' })).status, 200, 'idempotente')
  assert.equal(t.Notificacao.filter((n) => n.tipo === 'SOLICITACAO_RECUSADA').length, 1, 'não notifica duas vezes')
  const contraria = await POST_DECIDIR(solId, { decisao: 'APROVADA' })
  assert.equal(contraria.status, 409)
  assert.equal((await json(contraria)).codigo, 'SOLICITACAO_JA_DECIDIDA')
  assert.equal(t.Inscricao.length, 2)
  // Líder vê a recusa com o motivo e pode pedir de novo.
  await como('lider')
  const vr = ((await json(await GET_VITRINE())).data as any[]).find((l) => l.categoriaId === C3)
  assert.equal(vr.situacao, 'RECUSADA')
  assert.equal(vr.motivoRecusa, 'Vagas esgotadas')
  assert.equal((await DEL_SOLIC(solId)).status, 409, 'não cancela solicitação já decidida')
  const nova = await POST_SOLIC(solic(EQ, C3))
  assert.equal(nova.status, 201)
  const solId2 = (await json(nova)).data.id as string
  assert.notEqual(solId2, solId)

  // --- 9. Aprovação cria a inscrição pelo caminho existente --------------------------------------------------------
  await como('org-2', 'organizador')
  // Janela fechou depois do pedido: a aprovação falha e a solicitação continua PENDENTE.
  t.Liga.find((l) => l.id === 2)!.inscricoesAbertas = false
  const falhou = await POST_DECIDIR(solId2, { decisao: 'APROVADA' })
  assert.equal(falhou.status, 403)
  assert.equal(t.SolicitacaoInscricao.find((s) => s.id === solId2)!.estado, 'PENDENTE', 'falha na inscrição desfaz a decisão')
  assert.equal(t.Inscricao.length, 2)
  t.Liga.find((l) => l.id === 2)!.inscricoesAbertas = true
  const apr = await POST_DECIDIR(solId2, { decisao: 'APROVADA' })
  assert.equal(apr.status, 200)
  const aprCorpo = (await json(apr)).data
  assert.equal(aprCorpo.estado, 'APROVADA')
  assert.equal(t.Inscricao.length, 3)
  const criada = t.Inscricao.find((i) => i.categoriaCampeonatoId === C3)!
  assert.equal(criada.timeId, EQ)
  assert.equal(criada.status, 'CONFIRMADA')
  assert.equal(criada.criadoPor, 'lider', 'a inscrição é do líder que pediu')
  assert.equal(aprCorpo.inscricaoId, criada.id)
  assert.equal(t.SolicitacaoInscricao.find((s) => s.id === solId2)!.inscricaoId, criada.id)
  assert.equal(t.InscricaoAtleta.filter((a) => a.inscricaoId === criada.id).length, 6)
  assert.equal(t.Notificacao.filter((n) => n.usuarioId === 'lider' && n.tipo === 'SOLICITACAO_APROVADA').length, 1)
  const repetida = await POST_DECIDIR(solId2, { decisao: 'APROVADA' })
  assert.equal(repetida.status, 200)
  assert.equal((await json(repetida)).data.inscricaoId, criada.id, 'repetir devolve a mesma inscrição')
  assert.equal(t.Inscricao.length, 3, 'idempotente: não duplica a inscrição')
  assert.equal((await POST_DECIDIR(solId2, { decisao: 'RECUSADA' })).status, 409)
  await como('lider')
  assert.equal(((await json(await GET_VITRINE())).data as any[]).find((l) => l.categoriaId === C3).situacao, 'INSCRITA')

  // --- 10. Cancelamento pelo líder ----------------------------------------------------------------------------------------
  const p7 = await POST_SOLIC(solic(EQ, C7))
  assert.equal(p7.status, 201)
  const solId7 = (await json(p7)).data.id as string
  await como('assist')
  assert.equal((await DEL_SOLIC(solId7)).status, 403)
  await como('outro')
  assert.equal((await DEL_SOLIC(solId7)).status, 404, 'IDOR: solicitação de outra equipe = 404')
  assert.equal((await DEL_SOLIC('nao-uuid')).status, 404)
  assert.equal(t.SolicitacaoInscricao.find((s) => s.id === solId7)!.estado, 'PENDENTE')
  await como('tecnico')
  const cancelada = await DEL_SOLIC(solId7)
  assert.equal(cancelada.status, 200)
  assert.equal((await json(cancelada)).data.estado, 'CANCELADA')
  assert.equal((await DEL_SOLIC(solId7)).status, 200, 'idempotente')
  await como('org-2', 'organizador')
  assert.equal((await POST_DECIDIR(solId7, { decisao: 'APROVADA' })).status, 409, 'cancelada não pode ser aprovada')
  assert.equal((await json(await GET_LISTA('?estado=CANCELADA'))).data.length, 1)

  // --- 11. Modo da categoria (organizador) ---------------------------------------------------------------------------------
  await como('org-1', 'organizador')
  const ctx = (id: string): any => ({ params: Promise.resolve({ id }) })
  const m1 = await modo.GET(req('GET', '/x'), ctx(C1))
  assert.equal(m1.status, 200)
  assert.deepEqual((await json(m1)).data, { categoriaId: C1, ligaId: 1, modoInscricao: 'AUTOMATICA' })
  assert.equal((await modo.PUT(req('PUT', '/x', { modoInscricao: 'QUALQUER' }), ctx(C1))).status, 422)
  assert.equal((await modo.PUT(req('PUT', '/x', {}), ctx(C1))).status, 422)
  assert.equal((await modo.GET(req('GET', '/x'), ctx(C3))).status, 404, 'categoria de outro organizador = 404')
  assert.equal((await modo.PUT(req('PUT', '/x', { modoInscricao: 'AUTOMATICA' }), ctx(C3))).status, 404)
  assert.equal(t.CategoriaCampeonato.find((c) => c.id === C3)!.modoInscricao, 'APROVACAO', 'não alterou a categoria alheia')
  assert.equal((await modo.GET(req('GET', '/x'), ctx('nao-uuid'))).status, 404)
  const put = await modo.PUT(req('PUT', '/x', { modoInscricao: 'APROVACAO' }), ctx(C2))
  assert.equal(put.status, 200)
  assert.equal(t.CategoriaCampeonato.find((c) => c.id === C2)!.modoInscricao, 'APROVACAO')
  assert.equal((await json(await modo.GET(req('GET', '/x'), ctx(C2)))).data.modoInscricao, 'APROVACAO')
  await como('org-2', 'organizador')
  // Muda C7 para AUTOMATICA: o próximo pedido já entra direto.
  assert.equal((await modo.PUT(req('PUT', '/x', { modoInscricao: 'AUTOMATICA' }), ctx(C7))).status, 200)
  await como('lider')
  assert.equal(((await json(await GET_VITRINE())).data as any[]).find((l) => l.categoriaId === C7).modo, 'AUTOMATICA')
  const entrou = await POST_SOLIC(solic(EQ, C7))
  assert.equal(entrou.status, 201)
  assert.equal((await json(entrou)).data.estado, 'INSCRITA')
  // Finalizado não muda de modo.
  t.Liga.find((l) => l.id === 1)!.status = 'FINALIZADO'
  await como('org-1', 'organizador')
  assert.equal((await modo.PUT(req('PUT', '/x', { modoInscricao: 'AUTOMATICA' }), ctx(C1))).status, 409)
  t.Liga.find((l) => l.id === 1)!.status = 'ATIVA'

  // --- 12. Notificações do organizador ---------------------------------------------------------------------------------------
  await como('org-2', 'organizador')
  const ns = await notifs.GET(req('GET', '/api/organizador/notificacoes'))
  assert.equal(ns.status, 200)
  const corpoNs = await json(ns)
  assert.ok(corpoNs.data.every((n: any) => ['X', 'SOLICITACAO_INSCRICAO'].includes(n.tipo)), 'só as do próprio organizador')
  const naoLidas = corpoNs.naoLidas as number
  assert.ok(naoLidas >= 2)
  const alvo = corpoNs.data.find((n: any) => n.tipo === 'SOLICITACAO_INSCRICAO')
  assert.equal(alvo.lida, false)
  assert.equal((await lida.POST(req('POST', '/x'), ctx(alvo.id))).status, 200)
  assert.equal((await lida.POST(req('POST', '/x'), ctx(alvo.id))).status, 200, 'idempotente')
  assert.equal((await json(await notifs.GET(req('GET', '/x')))).naoLidas, naoLidas - 1)
  assert.equal((await json(await notifs.GET(req('GET', '/x?naoLidas=1')))).data.length, naoLidas - 1)
  await como('org-1', 'organizador')
  assert.equal((await lida.POST(req('POST', '/x'), ctx(NOTIF_ALHEIA))).status, 404, 'notificação de outro organizador = 404')
  assert.equal((await json(await notifs.GET(req('GET', '/x')))).data.length, 0)
  assert.equal(t.Notificacao.find((n) => n.id === NOTIF_ALHEIA)!.lidaEm, null)

  // --- 13. Sem as migrations pendentes: 503 ----------------------------------------------------------------------------------
  reiniciarCotas()
  const semTabela = tabelas()
  delete (semTabela as any).SolicitacaoInscricao
  novoBanco(semTabela)
  await como('lider')
  const v503 = await GET_VITRINE()
  assert.equal(v503.status, 200, 'vitrine segue sem a tabela de solicitações')
  assert.equal(((await json(v503)).data as any[]).length, 3)
  const mesmoModo = await POST_SOLIC(solic(EQ, C1))
  assert.equal(mesmoModo.status, 201, 'AUTOMATICA não depende da tabela nova')
  const p503 = await POST_SOLIC(solic(EQ, C3))
  assert.equal(p503.status, 503)
  assert.deepEqual(await json(p503), { error: 'Recurso ainda não habilitado neste ambiente.', codigo: 'RECURSO_NAO_HABILITADO' })
  assert.equal((await DEL_SOLIC(uuid(7))).status, 503)
  await como('org-2', 'organizador')
  const o503 = await GET_LISTA()
  assert.equal(o503.status, 503)
  assert.equal((await json(o503)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await POST_DECIDIR(uuid(7), { decisao: 'APROVADA' })).status, 503)
  // Coluna modoInscricao ausente.
  novoBanco(tabelas(), { colunasAusentes: { CategoriaCampeonato: ['modoInscricao'] } })
  const c503 = await modo.PUT(req('PUT', '/x', { modoInscricao: 'APROVACAO' }), ctx(C3))
  assert.equal(c503.status, 503)
  assert.equal((await json(c503)).error, 'Recurso ainda não habilitado neste ambiente.')
  // Notificação ausente: o pedido não cai (falha em silêncio).
  const semNotif = tabelas()
  delete (semNotif as any).Notificacao
  novoBanco(semNotif)
  await como('lider')
  reiniciarCotas()
  assert.equal((await POST_SOLIC(solic(EQ, C3))).status, 201, 'sem a tabela de notificações o pedido ainda é registrado')
  await como('org-2', 'organizador')
  assert.equal((await notifs.GET(req('GET', '/x'))).status, 503)

  console.log('inscricao-solicitacao.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
