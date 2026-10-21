// Pagamento por comprovante (R19), pelas rotas: configuração da categoria (PUT/GET), pagamento da inscrição,
// decisão (confirmar, recusar, isentar), URL assinada de 60 s, consulta do líder, upload do comprovante,
// regra "APROVAR só com pagamento confirmado ou isento" (painel e lote), listagem/CSV, IDOR, flags e 503.
import assert from 'node:assert/strict'
import { IDS, bancoComTabelas, criarAmbiente } from './helpers/ambiente-elenco'
import type { LinhaEscrita } from './helpers/fake-supabase-escrita'

const amb = criarAmbiente()
const { req, json, entrar } = amb

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const CAT4 = uuid(6) // liga 3, finalizada
const ORG_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const INS = {
  A: IDS.INS1, // EQ, CAT1 (cobra), sem pagamento ainda
  SEM_COBRANCA: uuid(7), // EQ, CAT3 (não cobra)
  EQ_B: uuid(8), // equipe B, CAT1
  ORG2: uuid(9), // equipe B, CAT2 (liga 2, outro organizador)
  FINAL: 'a1111111-1111-4111-8111-111111111111', // liga 3 finalizada
  G: Array.from({ length: 8 }, (_, i) => `a${i}000000-0000-4000-8000-000000000000`), // inscrições para o gate
}
const LINK = 'https://projeto-teste.supabase.co'
const config = (extra: Record<string, unknown> = {}) => ({ pagamentoModo: 'COMPROVANTE', valorInscricaoCentavos: 5000, pixChave: 'chave-pix-secreta', pixBeneficiario: 'Liga Norte', pagamentoInstrucoes: 'Envie o comprovante', ...extra })

function tabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}) {
  const insc = (id: string, timeId: string, categoria: string, ligaId: number, status = 'EM_ANALISE', outros: Record<string, unknown> = {}) => ({
    id, ligaId, categoriaCampeonatoId: categoria, timeId, status, criadoPor: timeId === IDS.EQ ? 'lider' : 'outro', criadoEm: '2026-01-01T10:00:00Z', atualizadoEm: '2026-01-02T10:00:00Z', posicaoEspera: null, equipeLegadoId: null, ...outros,
  })
  return {
    Liga: [
      { id: 1, nome: 'Copa Norte', organizadorId: 'org1', status: 'ATIVA' },
      { id: 2, nome: 'Copa Sul', organizadorId: 'org2', status: 'ATIVA' },
      { id: 3, nome: 'Copa Antiga', organizadorId: 'org1', status: 'FINALIZADO' },
    ],
    CategoriaCampeonato: [
      { id: IDS.CAT1, ligaId: 1, nome: 'Adulto Feminino', removidaEm: null },
      { id: IDS.CAT2, ligaId: 2, nome: 'Adulto Misto', removidaEm: null },
      { id: IDS.CAT3, ligaId: 1, nome: 'Sub 23', removidaEm: null },
      { id: CAT4, ligaId: 3, nome: 'Antiga', removidaEm: null },
    ],
    CategoriaConfiguracao: [
      { categoriaCampeonatoId: IDS.CAT1, ligaId: 1, ...config() },
      { categoriaCampeonatoId: IDS.CAT2, ligaId: 2, ...config({ pixChave: 'pix-da-outra-liga' }) },
    ],
    Inscricao: [
      insc(INS.A, IDS.EQ, IDS.CAT1, 1),
      insc(INS.SEM_COBRANCA, IDS.EQ, IDS.CAT3, 1),
      insc(INS.EQ_B, IDS.EQ_B, IDS.CAT1, 1),
      insc(INS.ORG2, IDS.EQ_B, IDS.CAT2, 2),
      insc(INS.FINAL, IDS.EQ, CAT4, 3),
      ...INS.G.map((id) => insc(id, IDS.EQ, IDS.CAT1, 1)),
    ],
    PagamentoInscricao: [],
    ComentarioInscricao: [],
    Organizador: [{ id: ORG_UUID, nome: 'Org Um', legadoId: 'org1' }],
    MembroOrganizador: [
      { organizadorId: ORG_UUID, usuarioId: 'adm', papel: 'ADMINISTRADOR' },
      { organizadorId: ORG_UUID, usuarioId: 'fin', papel: 'FINANCEIRO' },
      { organizadorId: ORG_UUID, usuarioId: 'arb', papel: 'ARBITRAGEM' },
    ],
    ...extra,
  } as Record<string, LinhaEscrita[]>
}

function novoBanco(extra: Record<string, LinhaEscrita[] | undefined> = {}, opcoes = {}) {
  const ambiente = bancoComTabelas(tabelas(extra), opcoes)
  amb.banco.atual = ambiente.banco
  return ambiente.tabelas
}

const nada = Symbol('ausente')
const doId = (id: string) => ({ params: Promise.resolve({ id }) })
const doInsc = (inscricaoId: string) => ({ params: Promise.resolve({ inscricaoId }) })

async function main() {
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const cfgRota = await import('../src/app/api/organizador/categorias/[id]/pagamento/route')
  const pagRota = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/route')
  const urlRota = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/comprovante-url/route')
  const decidirRota = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/pagamento/decidir/route')
  const liderRota = await import('../src/app/api/meu-time/inscricoes/[id]/pagamento/route')
  const assinar = await import('../src/app/api/meu-time/uploads/assinar/route')
  const confirmar = await import('../src/app/api/meu-time/uploads/confirmar/route')
  const painelDecidir = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/decidir/route')
  const painelLote = await import('../src/app/api/organizador/inscricoes/lote/route')
  const painelLista = await import('../src/app/api/organizador/inscricoes/route')
  const painelExportar = await import('../src/app/api/organizador/inscricoes/exportar/route')
  const inscricaoRota = await import('../src/app/api/meu-time/equipes/[id]/inscricoes/route')
  const { garantirPagamentoSemFalhar } = await import('../src/lib/pagamento-comprovante/servico')

  let reiniciar = true
  const livre = () => { if (reiniciar) reiniciarCotas() }
  const como = async (usuario: string, tipo: 'equipe' | 'organizador' = 'organizador') => {
    reiniciarCotas()
    await entrar(usuario, tipo)
  }
  const GET_CFG = (id: string) => (livre(), cfgRota.GET(req('GET', `/api/organizador/categorias/${id}/pagamento`), doId(id)))
  const PUT_CFG = (id: string, corpo: unknown) => (livre(), cfgRota.PUT(req('PUT', `/api/organizador/categorias/${id}/pagamento`, corpo), doId(id)))
  const GET_PAG = (id: string) => (livre(), pagRota.GET(req('GET', `/x/${id}/pagamento`), doInsc(id)))
  const GET_URL = (id: string) => (livre(), urlRota.GET(req('GET', `/x/${id}/pagamento/comprovante-url`), doInsc(id)))
  const DECIDIR = (id: string, corpo: unknown) => (livre(), decidirRota.POST(req('POST', `/x/${id}/pagamento/decidir`, corpo), doInsc(id)))
  const GET_LIDER = (id: string) => (livre(), liderRota.GET(req('GET', `/api/meu-time/inscricoes/${id}/pagamento`), { params: { id } }))
  const ASSINAR = (corpo: unknown) => (livre(), assinar.POST(req('POST', '/api/meu-time/uploads/assinar', corpo)))
  const CONFIRMAR = (corpo: unknown) => (livre(), confirmar.POST(req('POST', '/api/meu-time/uploads/confirmar', corpo)))
  const APROVAR = (id: string) => (livre(), painelDecidir.POST(req('POST', `/x/${id}`, { acao: 'APROVAR' }), doInsc(id)))
  const linhaPag = (t: Record<string, LinhaEscrita[]>, inscricaoId: string) => t.PagamentoInscricao.find((l) => l.inscricaoId === inscricaoId)
  const comprovante = (equipeId = IDS.EQ, inscricaoId = INS.A) => ({ equipeId, inscricaoId, tipo: 'COMPROVANTE', nomeArquivo: 'pix.pdf', contentType: 'application/pdf', tamanho: 100_000 })

  process.env.MEU_TIME_ATIVO = '1'
  process.env.ELENCO_COMPLETO_ATIVO = '1'
  process.env.PAINEL_INSCRICOES_ATIVO = '1'

  // --- 1. Flag desligada: 404 em tudo que é novo -----------------------------------------------------------------
  delete process.env.PAGAMENTO_COMPROVANTE_ATIVO
  let t = novoBanco()
  await como('org1')
  assert.equal((await GET_CFG(IDS.CAT1)).status, 404)
  assert.equal((await PUT_CFG(IDS.CAT1, { modo: 'NENHUM' })).status, 404)
  assert.equal((await GET_PAG(INS.A)).status, 404)
  assert.equal((await GET_URL(INS.A)).status, 404)
  assert.equal((await DECIDIR(INS.A, { decisao: 'ISENTAR' })).status, 404)
  await como('lider', 'equipe')
  assert.equal((await GET_LIDER(INS.A)).status, 404)
  assert.equal((await ASSINAR(comprovante())).status, 404, 'tipo COMPROVANTE sem a flag')
  assert.equal((await CONFIRMAR({ equipeId: IDS.EQ, inscricaoId: INS.A, tipo: 'COMPROVANTE', path: `${INS.A}/${uuid(1)}.pdf` })).status, 404)
  // Os tipos existentes continuam como antes, sem a flag.
  assert.equal((await ASSINAR({ equipeId: IDS.EQ, tipo: 'ESCUDO', nomeArquivo: 'e.png', contentType: 'image/png', tamanho: 1000 })).status, 200)
  // Aprovar não é barrado sem a flag, nem a listagem ganha `pagamento`, nem o CSV a coluna.
  await como('org1')
  assert.equal((await APROVAR(INS.A)).status, 200, 'sem a flag a aprovação não olha o pagamento')
  const listaSemFlag = await json(await painelLista.GET(req('GET', '/api/organizador/inscricoes')))
  assert.ok(listaSemFlag.data.itens.every((i: any) => !('pagamento' in i)))
  const csvSemFlag = await (await painelExportar.GET(req('GET', '/api/organizador/inscricoes/exportar'))).text()
  assert.ok(!csvSemFlag.includes(';pagamento'))
  assert.equal(linhaPag(t, INS.A), undefined, 'nada é criado sem a flag')
  process.env.PAGAMENTO_COMPROVANTE_ATIVO = '1'

  // --- 2. Autenticação ----------------------------------------------------------------------------------------------
  t = novoBanco()
  amb.sessao.token = null
  assert.equal((await GET_CFG(IDS.CAT1)).status, 401)
  assert.equal((await DECIDIR(INS.A, { decisao: 'ISENTAR' })).status, 401)
  assert.equal((await GET_LIDER(INS.A)).status, 401)
  await como('lider', 'equipe')
  assert.equal((await GET_CFG(IDS.CAT1)).status, 401, 'conta de equipe não entra nas rotas do organizador')
  assert.equal((await DECIDIR(INS.A, { decisao: 'ISENTAR' })).status, 401)
  await como('org1')
  assert.equal((await GET_LIDER(INS.A)).status, 401, 'organizador não entra na rota do líder')

  // --- 3. PUT/GET da configuração da categoria --------------------------------------------------------------------
  t = novoBanco()
  await como('org1')
  let r = await GET_CFG(IDS.CAT1)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.deepEqual((await json(r)).data, { modo: 'COMPROVANTE', valorCentavos: 5000, pixChave: 'chave-pix-secreta', pixBeneficiario: 'Liga Norte', instrucoes: 'Envie o comprovante' })

  // Validações do PUT (422) e nada gravado.
  const antes = JSON.stringify(t.CategoriaConfiguracao)
  const invalidos: unknown[] = [
    {}, { modo: 'X' }, { modo: 'COMPROVANTE' }, { modo: 'COMPROVANTE', valorCentavos: 5000 }, { modo: 'COMPROVANTE', pixChave: 'k' },
    { modo: 'COMPROVANTE', valorCentavos: 0, pixChave: 'k' }, { modo: 'COMPROVANTE', valorCentavos: -10, pixChave: 'k' },
    { modo: 'COMPROVANTE', valorCentavos: 12.5, pixChave: 'k' }, { modo: 'COMPROVANTE', valorCentavos: 99_999_999, pixChave: 'k' },
    { modo: 'COMPROVANTE', valorCentavos: 100, pixChave: 'k'.repeat(141) }, { modo: 'COMPROVANTE', valorCentavos: 100, pixChave: 'k', instrucoes: 'i'.repeat(501) },
    { modo: 'COMPROVANTE', valorCentavos: 100, pixChave: 'k', pixBeneficiario: 'b'.repeat(101) }, { modo: 'NENHUM', comprovantePath: 'x' },
  ]
  for (const corpo of invalidos) {
    r = await PUT_CFG(IDS.CAT1, corpo)
    assert.equal(r.status, 422, JSON.stringify(corpo))
    assert.equal((await json(r)).codigo, 'DADOS_INVALIDOS')
  }
  assert.equal(JSON.stringify(t.CategoriaConfiguracao), antes, 'nenhuma gravação nos casos inválidos')
  assert.equal((await cfgRota.PUT(new (await import('next/server')).NextRequest('http://127.0.0.1:3001/x', { method: 'PUT', body: 'não é json' }), doId(IDS.CAT1))).status, 400)

  // Grava (linha existente) e (linha inexistente: cria com ligaId).
  r = await PUT_CFG(IDS.CAT1, { modo: 'COMPROVANTE', valorCentavos: 8000, pixChave: ' nova@chave.com ', pixBeneficiario: 'Tesouraria', instrucoes: 'Pague até sexta' })
  assert.equal(r.status, 200)
  assert.deepEqual((await json(r)).data, { modo: 'COMPROVANTE', valorCentavos: 8000, pixChave: 'nova@chave.com', pixBeneficiario: 'Tesouraria', instrucoes: 'Pague até sexta' })
  assert.equal(t.CategoriaConfiguracao.find((l) => l.categoriaCampeonatoId === IDS.CAT1)!.valorInscricaoCentavos, 8000)
  r = await PUT_CFG(IDS.CAT3, { modo: 'COMPROVANTE', valorCentavos: 2500, pixChave: 'k3' })
  assert.equal(r.status, 200)
  const nova = t.CategoriaConfiguracao.find((l) => l.categoriaCampeonatoId === IDS.CAT3)!
  assert.equal(nova.ligaId, 1)
  assert.equal(nova.pagamentoModo, 'COMPROVANTE')
  assert.equal(nova.pixBeneficiario, null)
  // NENHUM com 0 explícito (Gratuito) mexe só no que veio.
  r = await PUT_CFG(IDS.CAT3, { modo: 'NENHUM', valorCentavos: 0 })
  assert.equal(r.status, 200)
  assert.equal(nova.pagamentoModo, 'NENHUM')
  assert.equal(nova.valorInscricaoCentavos, 0)
  assert.equal(nova.pixChave, 'k3', 'o que não veio no corpo fica como estava')
  // Idempotente.
  const repetida = await PUT_CFG(IDS.CAT3, { modo: 'NENHUM', valorCentavos: 0 })
  assert.deepEqual((await json(repetida)).data, { modo: 'NENHUM', valorCentavos: 0, pixChave: 'k3', pixBeneficiario: null, instrucoes: null })

  // Categoria inexistente, uuid inválido e outro organizador (IDOR).
  assert.equal((await GET_CFG(uuid(4))).status, 404)
  assert.equal((await PUT_CFG('nao-e-uuid', { modo: 'NENHUM' })).status, 404)
  assert.equal((await GET_CFG(IDS.CAT2)).status, 404, 'categoria de outro organizador')
  assert.equal((await PUT_CFG(IDS.CAT2, { modo: 'NENHUM' })).status, 404)
  assert.equal(t.CategoriaConfiguracao.find((l) => l.categoriaCampeonatoId === IDS.CAT2)!.pagamentoModo, 'COMPROVANTE', 'IDOR não gravou')
  await como('org2')
  assert.equal((await GET_CFG(IDS.CAT1)).status, 404)
  assert.equal((await PUT_CFG(IDS.CAT1, { modo: 'NENHUM' })).status, 404)
  assert.equal((await GET_CFG(IDS.CAT2)).status, 200)
  // Papéis: ADMINISTRADOR escreve; FINANCEIRO e ARBITRAGEM só leem.
  await como('adm')
  assert.equal((await PUT_CFG(IDS.CAT1, { modo: 'NENHUM' })).status, 200)
  assert.equal((await PUT_CFG(IDS.CAT1, { modo: 'COMPROVANTE', valorCentavos: 5000, pixChave: 'chave-pix-secreta', pixBeneficiario: 'Liga Norte', instrucoes: 'Envie o comprovante' })).status, 200)
  for (const papel of ['fin', 'arb']) {
    await como(papel)
    assert.equal((await GET_CFG(IDS.CAT1)).status, 200, `${papel} lê`)
    r = await PUT_CFG(IDS.CAT1, { modo: 'NENHUM' })
    assert.equal(r.status, 403, `${papel} não escreve`)
    assert.equal((await json(r)).codigo, 'SEM_PERMISSAO')
  }
  assert.equal(t.CategoriaConfiguracao.find((l) => l.categoriaCampeonatoId === IDS.CAT1)!.pagamentoModo, 'COMPROVANTE')
  // Campeonato finalizado: consulta sim, escrita 409.
  await como('org1')
  t.CategoriaConfiguracao.push({ categoriaCampeonatoId: CAT4, ligaId: 3, pagamentoModo: 'NENHUM', valorInscricaoCentavos: null })
  assert.equal((await GET_CFG(CAT4)).status, 200)
  r = await PUT_CFG(CAT4, { modo: 'COMPROVANTE', valorCentavos: 100, pixChave: 'k' })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'CAMPEONATO_FINALIZADO')
  // Limite de requisições nas escritas.
  await como('org1')
  reiniciar = false
  let limitada = 0
  for (let i = 0; i < 25; i += 1) if ((await PUT_CFG(IDS.CAT3, { modo: 'NENHUM' })).status === 429) limitada += 1
  reiniciar = true
  assert.ok(limitada >= 4, 'escritas passam do limite e recebem 429')

  // --- 4. Cópia do valor na criação do pagamento ---------------------------------------------------------------------
  t = novoBanco()
  await como('org1')
  assert.equal(await garantirPagamentoSemFalhar(INS.SEM_COBRANCA).then((l) => l), null, 'categoria sem cobrança não cria pagamento')
  assert.equal(t.PagamentoInscricao.length, 0)
  const criado = await garantirPagamentoSemFalhar(INS.A)
  assert.equal(criado?.estado, 'PENDENTE')
  assert.equal(criado?.valorCentavos, 5000)
  assert.equal(await PUT_CFG(IDS.CAT1, { modo: 'COMPROVANTE', valorCentavos: 9000, pixChave: 'k' }).then((x) => x.status), 200)
  await garantirPagamentoSemFalhar(INS.A)
  assert.equal(t.PagamentoInscricao.length, 1, 'idempotente')
  assert.equal(linhaPag(t, INS.A)!.valorCentavos, 5000, 'mudar o valor depois não altera a cópia')
  await garantirPagamentoSemFalhar(INS.G[0])
  assert.equal(linhaPag(t, INS.G[0])!.valorCentavos, 9000, 'quem entra depois leva o valor novo')
  assert.equal(await garantirPagamentoSemFalhar('nao-e-uuid'), null)
  // Pela rota de inscrição da equipe: a resposta traz o pagamento.
  t = novoBanco({
    Inscricao: [],
    Liga: [{ id: 1, nome: 'Copa Norte', organizadorId: 'org1', status: 'ATIVA', inscricoesAbertas: true }, { id: 2, nome: 'Copa Sul', organizadorId: 'org2', status: 'ATIVA' }],
    RegraElenco: [],
    InscricaoAtleta: [],
  })
  await como('lider', 'equipe')
  const atletas = [1, 2, 3, 4, 5, 6].map((n) => ({ atletaId: IDS.atleta(n), numero: n, capitao: n === 1 }))
  r = await inscricaoRota.POST(req('POST', `/api/meu-time/equipes/${IDS.EQ}/inscricoes`, { categoriaCampeonatoId: IDS.CAT1, atletas }), { params: { id: IDS.EQ } })
  assert.equal(r.status, 201, JSON.stringify(await r.clone().json()))
  let corpo = await json(r)
  assert.deepEqual(corpo.pagamento, { exige: true, estado: 'PENDENTE', valorCentavos: 5000 })
  assert.equal(linhaPag(t, corpo.data.id)!.valorCentavos, 5000)
  assert.equal(linhaPag(t, corpo.data.id)!.estado, 'PENDENTE')
  r = await inscricaoRota.POST(req('POST', `/api/meu-time/equipes/${IDS.EQ}/inscricoes`, { categoriaCampeonatoId: IDS.CAT3, atletas }), { params: { id: IDS.EQ } })
  assert.equal(r.status, 201)
  assert.ok(!('pagamento' in (await json(r))), 'categoria sem cobrança não leva pagamento')

  // --- 5. Pagamento da inscrição e decisão --------------------------------------------------------------------------------
  t = novoBanco({
    PagamentoInscricao: [
      { id: uuid(1), inscricaoId: INS.G[0], valorCentavos: 5000, estado: 'COMPROVANTE_ENVIADO', comprovantePath: `${INS.G[0]}/${uuid(2)}.pdf`, comprovanteEnviadoEm: '2026-02-01T10:00:00Z', decididoPor: null, decididoEm: null, motivoRecusa: null },
      { id: uuid(2), inscricaoId: INS.G[1], valorCentavos: 5000, estado: 'COMPROVANTE_ENVIADO', comprovantePath: `${INS.G[1]}/${uuid(3)}.png`, comprovanteEnviadoEm: '2026-02-01T10:00:00Z', decididoPor: null, decididoEm: null, motivoRecusa: null },
      { id: uuid(3), inscricaoId: INS.G[2], valorCentavos: 5000, estado: 'PENDENTE', comprovantePath: null, comprovanteEnviadoEm: null, decididoPor: null, decididoEm: null, motivoRecusa: null },
    ],
    Notificacao: [],
  })
  await como('org1')
  r = await GET_PAG(INS.G[0])
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  corpo = await json(r)
  assert.deepEqual(Object.keys(corpo.data).sort(), ['comprovanteEnviadoEm', 'decididoEm', 'estado', 'exige', 'motivoRecusa', 'temComprovante', 'valorCentavos'])
  assert.equal(corpo.data.estado, 'COMPROVANTE_ENVIADO')
  assert.equal(corpo.data.temComprovante, true)
  assert.ok(!JSON.stringify(corpo).includes(uuid(2)) && !JSON.stringify(corpo).includes('comprovantePath'), 'nunca devolve o caminho do comprovante')
  // Sem linha e a categoria cobra: PENDENTE calculado, sem gravar. Sem cobrança: exige=false.
  corpo = await json(await GET_PAG(INS.G[5]))
  assert.deepEqual(corpo.data, { exige: true, valorCentavos: 5000, estado: 'PENDENTE', comprovanteEnviadoEm: null, decididoEm: null, motivoRecusa: null, temComprovante: false })
  assert.equal(linhaPag(t, INS.G[5]), undefined, 'GET do organizador não escreve')
  corpo = await json(await GET_PAG(INS.SEM_COBRANCA))
  assert.equal(corpo.data.exige, false)
  assert.equal(corpo.data.estado, null)
  // IDOR e papéis.
  assert.equal((await GET_PAG(INS.ORG2)).status, 404, 'inscrição de outro organizador')
  assert.equal((await GET_PAG('nao-e-uuid')).status, 404)
  assert.equal((await GET_PAG(uuid(5))).status, 404)
  await como('org2')
  assert.equal((await GET_PAG(INS.G[0])).status, 404)
  assert.equal((await DECIDIR(INS.G[0], { decisao: 'CONFIRMAR' })).status, 404)
  assert.equal((await GET_URL(INS.G[0])).status, 404)
  await como('arb')
  assert.equal((await GET_PAG(INS.G[0])).status, 200, 'ARBITRAGEM consulta o estado')
  assert.equal((await DECIDIR(INS.G[0], { decisao: 'CONFIRMAR' })).status, 403)
  assert.equal((await GET_URL(INS.G[0])).status, 403, 'ARBITRAGEM não vê o comprovante')
  assert.equal(linhaPag(t, INS.G[0])!.estado, 'COMPROVANTE_ENVIADO')

  // Validação da decisão.
  await como('fin')
  for (const corpoRuim of [{}, { decisao: 'PAGAR' }, { decisao: 'RECUSAR' }, { decisao: 'RECUSAR', motivo: '  ' }, { decisao: 'CONFIRMAR', extra: 1 }]) {
    assert.equal((await DECIDIR(INS.G[0], corpoRuim)).status, 422, JSON.stringify(corpoRuim))
  }
  // CONFIRMAR (FINANCEIRO pode) + aviso ao líder; repetir é idempotente e não avisa de novo.
  r = await DECIDIR(INS.G[0], { decisao: 'CONFIRMAR' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.estado, 'CONFIRMADO')
  assert.ok(corpo.data.decididoEm)
  assert.equal(linhaPag(t, INS.G[0])!.decididoPor, 'fin')
  const avisos = () => t.Notificacao.filter((n) => n.tipo === 'PAGAMENTO_CONFIRMADO')
  assert.equal(avisos().length, 2, 'líder e técnico recebem')
  assert.deepEqual(avisos().map((n) => n.usuarioId).sort(), ['lider', 'tec'])
  assert.ok(!JSON.stringify(t.Notificacao).includes('chave-pix'), 'sem chave Pix nas notificações')
  assert.equal((await DECIDIR(INS.G[0], { decisao: 'CONFIRMAR' })).status, 200)
  assert.equal(avisos().length, 2, 'idempotente: sem novo aviso')
  // Decisão contrária = 409.
  for (const contraria of [{ decisao: 'RECUSAR', motivo: 'x' }, { decisao: 'ISENTAR' }]) {
    r = await DECIDIR(INS.G[0], contraria)
    assert.equal(r.status, 409)
    assert.equal((await json(r)).codigo, 'PAGAMENTO_CONFLITO')
  }
  assert.equal(linhaPag(t, INS.G[0])!.estado, 'CONFIRMADO')
  // RECUSAR com motivo, aviso com o motivo, idempotência e conflito.
  await como('org1')
  r = await DECIDIR(INS.G[1], { decisao: 'RECUSAR', motivo: 'comprovante ilegível' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.estado, 'RECUSADO')
  assert.equal(corpo.data.motivoRecusa, 'comprovante ilegível')
  const recusas = t.Notificacao.filter((n) => n.tipo === 'PAGAMENTO_RECUSADO')
  assert.equal(recusas.length, 2)
  assert.ok(recusas[0].mensagem.includes('comprovante ilegível'))
  assert.equal((await DECIDIR(INS.G[1], { decisao: 'RECUSAR', motivo: 'outro motivo qualquer' })).status, 200)
  assert.equal(linhaPag(t, INS.G[1])!.motivoRecusa, 'comprovante ilegível', 'repetição não troca o motivo')
  assert.equal(t.Notificacao.filter((n) => n.tipo === 'PAGAMENTO_RECUSADO').length, 2)
  assert.equal((await DECIDIR(INS.G[1], { decisao: 'CONFIRMAR' })).status, 409, 'confirmar um recusado é decisão contrária')
  // PENDENTE: não há comprovante para confirmar/recusar; ISENTAR vale e é idempotente (sem aviso).
  assert.equal((await DECIDIR(INS.G[2], { decisao: 'CONFIRMAR' })).status, 409)
  assert.equal((await DECIDIR(INS.G[2], { decisao: 'RECUSAR', motivo: 'm' })).status, 409)
  const totalAvisos = t.Notificacao.length
  r = await DECIDIR(INS.G[2], { decisao: 'ISENTAR' })
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.estado, 'ISENTO')
  assert.equal((await DECIDIR(INS.G[2], { decisao: 'ISENTAR' })).status, 200)
  assert.equal(t.Notificacao.length, totalAvisos, 'isentar não notifica')
  // RECUSADO pode ser isentado.
  assert.equal((await json(await DECIDIR(INS.G[1], { decisao: 'ISENTAR' }))).data.estado, 'ISENTO')
  // Sem linha e a categoria cobra: a linha nasce PENDENTE e ISENTAR a libera. Sem cobrança: 409.
  assert.equal((await DECIDIR(INS.G[5], { decisao: 'ISENTAR' })).status, 200)
  assert.equal(linhaPag(t, INS.G[5])!.valorCentavos, 5000)
  r = await DECIDIR(INS.SEM_COBRANCA, { decisao: 'ISENTAR' })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'SEM_COBRANCA')
  // Campeonato finalizado e inscrição removida: 409.
  r = await DECIDIR(INS.FINAL, { decisao: 'ISENTAR' })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'CAMPEONATO_FINALIZADO')
  t.Inscricao.find((l) => l.id === INS.G[6])!.status = 'REMOVIDA'
  assert.equal((await DECIDIR(INS.G[6], { decisao: 'ISENTAR' })).status, 409)
  // Corrida: duas decisões ao mesmo tempo, uma só vence e a outra recebe o mesmo resultado ou 409.
  t.PagamentoInscricao.push({ id: uuid(4), inscricaoId: INS.G[7], valorCentavos: 5000, estado: 'COMPROVANTE_ENVIADO', comprovantePath: `${INS.G[7]}/${uuid(2)}.pdf`, comprovanteEnviadoEm: 'x', decididoPor: null, decididoEm: null, motivoRecusa: null })
  const [d1, d2] = await Promise.all([DECIDIR(INS.G[7], { decisao: 'CONFIRMAR' }), DECIDIR(INS.G[7], { decisao: 'RECUSAR', motivo: 'm' })])
  assert.deepEqual([d1.status, d2.status].sort(), [200, 409])
  assert.ok(['CONFIRMADO', 'RECUSADO'].includes(linhaPag(t, INS.G[7])!.estado))

  // --- 6. URL assinada de 60 s ---------------------------------------------------------------------------------------------
  t = novoBanco({
    PagamentoInscricao: [
      { id: uuid(1), inscricaoId: INS.A, valorCentavos: 5000, estado: 'COMPROVANTE_ENVIADO', comprovantePath: `${INS.A}/${uuid(2)}.pdf`, comprovanteEnviadoEm: 'x', decididoPor: null, decididoEm: null, motivoRecusa: null },
      { id: uuid(2), inscricaoId: INS.G[0], valorCentavos: 5000, estado: 'PENDENTE', comprovantePath: null, comprovanteEnviadoEm: null, decididoPor: null, decididoEm: null, motivoRecusa: null },
      { id: uuid(3), inscricaoId: INS.G[1], valorCentavos: 5000, estado: 'COMPROVANTE_ENVIADO', comprovantePath: `${INS.A}/${uuid(2)}.pdf`, comprovanteEnviadoEm: 'x', decididoPor: null, decididoEm: null, motivoRecusa: null },
    ],
  })
  await como('org1')
  r = await GET_URL(INS.A)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  corpo = await json(r)
  assert.deepEqual(Object.keys(corpo.data).sort(), ['expiraEm', 'url'])
  assert.ok(corpo.data.url.startsWith(`${LINK}/storage/v1/object/sign/comprovante-pagamento/${INS.A}/`))
  assert.deepEqual(amb.assinadosLeitura.at(-1), { caminho: `comprovante-pagamento/${INS.A}/${uuid(2)}.pdf`, segundos: 60 })
  const duracao = new Date(corpo.data.expiraEm).getTime() - Date.now()
  assert.ok(duracao > 50_000 && duracao <= 61_000, 'expira em 60 s')
  await como('fin')
  assert.equal((await GET_URL(INS.A)).status, 200, 'FINANCEIRO vê o comprovante')
  await como('adm')
  assert.equal((await GET_URL(INS.A)).status, 200)
  await como('org1')
  assert.equal((await GET_URL(INS.G[0])).status, 404, 'sem comprovante')
  assert.equal((await GET_URL(INS.G[1])).status, 404, 'caminho de outra inscrição nunca é assinado')
  assert.equal((await GET_URL(INS.G[3])).status, 404, 'sem linha de pagamento')
  assert.equal((await GET_URL(INS.ORG2)).status, 404)
  amb.storage.bucketsAusentes.add('comprovante-pagamento')
  r = await GET_URL(INS.A)
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  amb.storage.bucketsAusentes.delete('comprovante-pagamento')

  // --- 7. Consulta do líder -------------------------------------------------------------------------------------------------
  t = novoBanco()
  await como('lider', 'equipe')
  r = await GET_LIDER(INS.A)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  corpo = await json(r)
  assert.deepEqual(corpo.data, {
    exige: true, valorCentavos: 5000, pix: { chave: 'chave-pix-secreta', beneficiario: 'Liga Norte', instrucoes: 'Envie o comprovante' }, estado: 'PENDENTE', comprovanteEnviado: false,
  })
  assert.equal(linhaPag(t, INS.A)!.estado, 'PENDENTE', 'a primeira consulta cria o pagamento pendente (cópia do valor)')
  // O líder vê o valor copiado, não o da categoria de hoje.
  t.CategoriaConfiguracao.find((l) => l.categoriaCampeonatoId === IDS.CAT1)!.valorInscricaoCentavos = 7777
  assert.equal((await json(await GET_LIDER(INS.A))).data.valorCentavos, 5000)
  // Recusado mostra o motivo; o caminho nunca aparece.
  Object.assign(linhaPag(t, INS.A)!, { estado: 'RECUSADO', motivoRecusa: 'borrado', comprovantePath: `${INS.A}/${uuid(2)}.pdf` })
  corpo = await json(await GET_LIDER(INS.A))
  assert.equal(corpo.data.estado, 'RECUSADO')
  assert.equal(corpo.data.motivoRecusa, 'borrado')
  assert.equal(corpo.data.comprovanteEnviado, true)
  assert.ok(!JSON.stringify(corpo).includes(uuid(2)))
  // Técnico vê; assistente 403; outra equipe 404 (a chave Pix não vaza); categoria sem cobrança não traz Pix.
  await como('tec', 'equipe')
  assert.equal((await GET_LIDER(INS.A)).status, 200)
  await como('assist', 'equipe')
  assert.equal((await GET_LIDER(INS.A)).status, 403)
  await como('outro', 'equipe')
  r = await GET_LIDER(INS.A)
  assert.equal(r.status, 404)
  assert.ok(!JSON.stringify(await json(r)).includes('chave-pix'))
  assert.equal((await GET_LIDER('nao-e-uuid')).status, 404)
  assert.equal((await GET_LIDER(uuid(5))).status, 404)
  await como('lider', 'equipe')
  assert.deepEqual((await json(await GET_LIDER(INS.SEM_COBRANCA))).data, { exige: false, valorCentavos: null, pix: null, estado: null, comprovanteEnviado: false })

  // --- 8. Upload do comprovante (assinar e confirmar) ------------------------------------------------------------------
  t = novoBanco({ Notificacao: [] })
  await como('lider', 'equipe')
  r = await ASSINAR(comprovante())
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.deepEqual(Object.keys(corpo.data).sort(), ['expiraEm', 'path', 'uploadUrl'])
  assert.match(corpo.data.path, new RegExp(`^${INS.A}/[0-9a-f-]{36}\\.pdf$`), 'path <inscricaoId>/<uuid>.<ext> gerado no servidor')
  assert.ok(!corpo.data.path.includes('pix'), 'o nome enviado nunca entra no path')
  assert.ok(corpo.data.uploadUrl.includes('comprovante-pagamento'))
  const caminho1: string = corpo.data.path
  // MIME, extensão e tamanho.
  assert.equal((await ASSINAR({ ...comprovante(), contentType: 'application/zip', nomeArquivo: 'x.zip' })).status, 415)
  assert.equal((await ASSINAR({ ...comprovante(), contentType: 'image/gif', nomeArquivo: 'x.gif' })).status, 415)
  assert.equal((await ASSINAR({ ...comprovante(), contentType: 'application/pdf', nomeArquivo: 'x.png' })).status, 415, 'extensão diferente do MIME')
  assert.equal((await ASSINAR({ ...comprovante(), nomeArquivo: '../../x.pdf' })).status, 422)
  assert.equal((await ASSINAR({ ...comprovante(), tamanho: 5 * 1024 * 1024 + 1 })).status, 413)
  assert.equal((await ASSINAR({ ...comprovante(), tamanho: 5 * 1024 * 1024 })).status, 200)
  assert.equal((await ASSINAR({ ...comprovante(), tamanho: 0 })).status, 422)
  for (const [mime, nome] of [['image/jpeg', 'a.jpg'], ['image/png', 'a.png'], ['image/webp', 'a.webp']]) {
    assert.equal((await ASSINAR({ ...comprovante(), contentType: mime, nomeArquivo: nome })).status, 200, mime)
  }
  // Dono: sem inscricaoId, com atletaId, outra equipe, inscrição de outra equipe, assistente.
  assert.equal((await ASSINAR({ ...comprovante(), inscricaoId: undefined })).status, 422)
  assert.equal((await ASSINAR({ ...comprovante(), atletaId: IDS.atleta(1) })).status, 422)
  assert.equal((await ASSINAR(comprovante(IDS.EQ, INS.EQ_B))).status, 404, 'inscrição de outra equipe')
  assert.equal((await ASSINAR(comprovante(IDS.EQ_B, INS.A))).status, 404, 'equipe alheia')
  assert.equal((await ASSINAR(comprovante(IDS.EQ, 'nao-e-uuid'))).status, 404)
  assert.equal((await ASSINAR(comprovante(IDS.EQ, INS.SEM_COBRANCA))).status, 409, 'categoria sem cobrança')
  assert.equal((await ASSINAR(comprovante(IDS.EQ, INS.FINAL))).status, 409, 'campeonato finalizado')
  await como('assist', 'equipe')
  assert.equal((await ASSINAR(comprovante())).status, 403)
  await como('outro', 'equipe')
  assert.equal((await ASSINAR(comprovante(IDS.EQ, INS.A))).status, 404)
  assert.equal((await ASSINAR(comprovante(IDS.EQ_B, INS.A))).status, 404, 'a inscrição não é da equipe B')

  // Confirmar.
  await como('lider', 'equipe')
  const confirmarCorpo = (path: string, extra: Record<string, unknown> = {}) => ({ equipeId: IDS.EQ, inscricaoId: INS.A, tipo: 'COMPROVANTE', path, ...extra })
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho1))).status, 409, 'o arquivo ainda não foi enviado')
  assert.equal((await CONFIRMAR(confirmarCorpo(`${INS.EQ_B}/${uuid(3)}.pdf`))).status, 422, 'path de outra inscrição')
  assert.equal((await CONFIRMAR(confirmarCorpo(`${INS.A}/../${INS.EQ_B}/${uuid(3)}.pdf`))).status, 422)
  assert.equal((await CONFIRMAR(confirmarCorpo(`${INS.A}/${uuid(3)}.exe`))).status, 422)
  assert.equal((await CONFIRMAR(confirmarCorpo(`${INS.A}/arquivo.pdf`))).status, 422)
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho1, { atletaId: IDS.atleta(1) }))).status, 422)
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho1, { inscricaoId: undefined }))).status, 422)
  // Objeto real com MIME ou tamanho fora da regra: apagado e nada gravado.
  const ruim = `${INS.A}/${uuid(4)}.pdf`
  amb.objetos.set(`comprovante-pagamento/${ruim}`, { size: 1000, contentType: 'application/zip' })
  assert.equal((await CONFIRMAR(confirmarCorpo(ruim))).status, 415)
  assert.ok(amb.removidos.includes(`comprovante-pagamento/${ruim}`))
  const grande = `${INS.A}/${uuid(5)}.pdf`
  amb.objetos.set(`comprovante-pagamento/${grande}`, { size: 5 * 1024 * 1024 + 1, contentType: 'application/pdf' })
  assert.equal((await CONFIRMAR(confirmarCorpo(grande))).status, 413)
  const naoCasa = `${INS.A}/${uuid(6)}.png`
  amb.objetos.set(`comprovante-pagamento/${naoCasa}`, { size: 1000, contentType: 'application/pdf' })
  assert.equal((await CONFIRMAR(confirmarCorpo(naoCasa))).status, 415, 'extensão do path não confere com o MIME real')
  assert.equal(linhaPag(t, INS.A)!.estado, 'PENDENTE')
  assert.ok(!linhaPag(t, INS.A)!.comprovantePath, 'nada gravado nos casos inválidos')
  // Bom: marca COMPROVANTE_ENVIADO e avisa o dono do campeonato.
  amb.objetos.set(`comprovante-pagamento/${caminho1}`, { size: 90_000, contentType: 'application/pdf' })
  r = await CONFIRMAR(confirmarCorpo(caminho1))
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  corpo = await json(r)
  assert.equal(corpo.data.estado, 'COMPROVANTE_ENVIADO')
  assert.ok(!JSON.stringify(corpo).includes(caminho1) && !('path' in corpo.data), 'a resposta não devolve o caminho')
  assert.equal(linhaPag(t, INS.A)!.estado, 'COMPROVANTE_ENVIADO')
  assert.equal(linhaPag(t, INS.A)!.comprovantePath, caminho1)
  assert.ok(linhaPag(t, INS.A)!.comprovanteEnviadoEm)
  const enviados = () => t.Notificacao.filter((n) => n.tipo === 'COMPROVANTE_ENVIADO')
  assert.equal(enviados().length, 1)
  assert.equal(enviados()[0].usuarioId, 'org1')
  assert.ok(!JSON.stringify(enviados()).includes(caminho1), 'a notificação não leva o caminho')
  // Idempotente: confirmar o mesmo arquivo de novo não avisa outra vez.
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho1))).status, 200)
  assert.equal(enviados().length, 1)
  // Substituir antes da decisão apaga o arquivo anterior.
  const caminho2 = `${INS.A}/${uuid(7)}.png`
  amb.objetos.set(`comprovante-pagamento/${caminho2}`, { size: 50_000, contentType: 'image/png' })
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho2))).status, 200)
  assert.equal(linhaPag(t, INS.A)!.comprovantePath, caminho2)
  assert.ok(amb.removidos.includes(`comprovante-pagamento/${caminho1}`))
  // A equipe B não confirma arquivo na inscrição da A.
  await como('outro', 'equipe')
  assert.equal((await CONFIRMAR({ equipeId: IDS.EQ_B, inscricaoId: INS.A, tipo: 'COMPROVANTE', path: caminho2 })).status, 404)
  assert.equal((await CONFIRMAR({ equipeId: IDS.EQ, inscricaoId: INS.A, tipo: 'COMPROVANTE', path: caminho2 })).status, 404)
  // Recusado: o líder reenvia e volta a COMPROVANTE_ENVIADO, sem o motivo antigo.
  await como('org1')
  assert.equal((await DECIDIR(INS.A, { decisao: 'RECUSAR', motivo: 'foto cortada' })).status, 200)
  await como('lider', 'equipe')
  assert.equal((await ASSINAR(comprovante())).status, 200, 'recusado pode reenviar')
  const caminho3 = `${INS.A}/${uuid(8)}.jpg`
  amb.objetos.set(`comprovante-pagamento/${caminho3}`, { size: 70_000, contentType: 'image/jpeg' })
  assert.equal((await CONFIRMAR(confirmarCorpo(caminho3))).status, 200)
  assert.equal(linhaPag(t, INS.A)!.estado, 'COMPROVANTE_ENVIADO')
  assert.equal(linhaPag(t, INS.A)!.motivoRecusa, null)
  assert.equal(linhaPag(t, INS.A)!.decididoEm, null)
  assert.equal(enviados().length, 3, 'cada comprovante novo avisa o organizador')
  // Decidido (confirmado ou isento): não aceita mais comprovante.
  await como('org1')
  assert.equal((await DECIDIR(INS.A, { decisao: 'CONFIRMAR' })).status, 200)
  await como('lider', 'equipe')
  r = await ASSINAR(comprovante())
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'PAGAMENTO_JA_DECIDIDO')
  amb.objetos.set(`comprovante-pagamento/${INS.A}/${uuid(9)}.pdf`, { size: 10, contentType: 'application/pdf' })
  assert.equal((await CONFIRMAR(confirmarCorpo(`${INS.A}/${uuid(9)}.pdf`))).status, 409)
  assert.equal(linhaPag(t, INS.A)!.comprovantePath, caminho3)
  // Os tipos existentes seguem funcionando com a flag ligada.
  assert.equal((await ASSINAR({ equipeId: IDS.EQ, tipo: 'ESCUDO', nomeArquivo: 'e.png', contentType: 'image/png', tamanho: 1000 })).status, 200)
  assert.equal((await ASSINAR({ equipeId: IDS.EQ, tipo: 'XPTO', nomeArquivo: 'e.png', contentType: 'image/png', tamanho: 1000 })).status, 422)
  // Bucket ausente = 503.
  amb.storage.bucketsAusentes.add('comprovante-pagamento')
  t.PagamentoInscricao.find((l) => l.inscricaoId === INS.A)!.estado = 'PENDENTE'
  r = await ASSINAR(comprovante())
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  amb.storage.bucketsAusentes.delete('comprovante-pagamento')

  // --- 9. Aprovar a inscrição exige pagamento confirmado ou isento (painel e lote) -----------------------------------------------
  const pagamento = (inscricaoId: string, estado: string, extra: Record<string, unknown> = {}) => ({ id: `b${inscricaoId.slice(1)}`, inscricaoId, valorCentavos: 5000, estado, comprovantePath: null, comprovanteEnviadoEm: null, decididoPor: null, decididoEm: null, motivoRecusa: null, ...extra })
  t = novoBanco({
    PagamentoInscricao: [
      pagamento(INS.G[0], 'PENDENTE'),
      pagamento(INS.G[1], 'COMPROVANTE_ENVIADO'),
      pagamento(INS.G[2], 'RECUSADO', { motivoRecusa: 'valor errado' }),
      pagamento(INS.G[3], 'CONFIRMADO'),
      pagamento(INS.G[4], 'ISENTO'),
    ],
    Notificacao: [],
  })
  await como('org1')
  let bloqueios = 0
  for (const [i, trecho] of [[0, /ainda não enviou o comprovante/], [1, /ainda não foi confirmado/], [2, /valor errado/]] as const) {
    r = await APROVAR(INS.G[i])
    assert.equal(r.status, 409, `estado ${i}`)
    corpo = await json(r)
    assert.equal(corpo.codigo, 'PAGAMENTO_PENDENTE')
    assert.match(corpo.error, trecho)
    assert.equal(t.Inscricao.find((l) => l.id === INS.G[i])!.status, 'EM_ANALISE', 'não aprovou')
    bloqueios += 1
  }
  assert.equal(bloqueios, 3)
  // Sem linha de pagamento: a tentativa cria o PENDENTE e bloqueia.
  assert.equal(linhaPag(t, INS.G[5]), undefined)
  assert.equal((await APROVAR(INS.G[5])).status, 409)
  assert.equal(linhaPag(t, INS.G[5])!.estado, 'PENDENTE')
  // Confirmado e isento aprovam; repetir continua 200 (idempotente).
  for (const i of [3, 4]) {
    r = await APROVAR(INS.G[i])
    assert.equal(r.status, 200, `liberado ${i}`)
    assert.equal((await json(r)).data.status, 'CONFIRMADA')
  }
  assert.equal((await APROVAR(INS.G[3])).status, 200)
  // Categoria sem cobrança aprova como sempre.
  assert.equal((await APROVAR(INS.SEM_COBRANCA)).status, 200)
  // Outras ações não são barradas (pedir correção, recusar).
  const CORRECAO = await painelDecidir.POST(req('POST', '/x', { acao: 'PEDIR_CORRECAO', mensagem: 'ajuste' }), doInsc(INS.G[0]))
  assert.equal(CORRECAO.status, 200)
  // Isentar libera a aprovação; confirmar também depois do comprovante.
  assert.equal((await DECIDIR(INS.G[0], { decisao: 'ISENTAR' })).status, 200)
  t.Inscricao.find((l) => l.id === INS.G[0])!.status = 'EM_ANALISE'
  assert.equal((await APROVAR(INS.G[0])).status, 200)
  // Lote: um erro não derruba os demais; o motivo vem como código.
  t.Inscricao.find((l) => l.id === INS.G[6])!.status = 'EM_ANALISE'
  t.PagamentoInscricao.push(pagamento(INS.G[6], 'CONFIRMADO'))
  r = await painelLote.POST(req('POST', '/x', { ids: [INS.G[1], INS.G[2], INS.G[6]], acao: 'APROVAR' }))
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.deepEqual(corpo.data.aprovadas, [INS.G[6]])
  assert.deepEqual(corpo.data.falhas, [{ id: INS.G[1], codigo: 'PAGAMENTO_PENDENTE' }, { id: INS.G[2], codigo: 'PAGAMENTO_PENDENTE' }])
  // Papéis do painel não mudam: FINANCEIRO continua sem aprovar inscrição.
  await como('fin')
  assert.equal((await APROVAR(INS.G[1])).status, 403)

  // --- 10. Painel: `pagamento` na lista e coluna no CSV ----------------------------------------------------------------------------
  await como('org1')
  r = await painelLista.GET(req('GET', '/api/organizador/inscricoes'))
  assert.equal(r.status, 200)
  corpo = await json(r)
  const item = (id: string) => corpo.data.itens.find((i: any) => i.id === id)
  assert.deepEqual(item(INS.G[1]).pagamento, { estado: 'COMPROVANTE_ENVIADO', valorCentavos: 5000 })
  assert.deepEqual(item(INS.G[2]).pagamento, { estado: 'RECUSADO', valorCentavos: 5000 })
  assert.deepEqual(item(INS.G[7]).pagamento, { estado: 'PENDENTE', valorCentavos: 5000 }, 'sem linha e a categoria cobra: pendente')
  assert.equal(item(INS.SEM_COBRANCA).pagamento, null, 'categoria sem cobrança')
  assert.ok(!JSON.stringify(corpo).match(/comprovantePath|chave-pix|pixChave/), 'a lista não vaza comprovante nem Pix')
  r = await painelExportar.GET(req('GET', '/api/organizador/inscricoes/exportar'))
  const csv = await r.text()
  const linhas = csv.replace('﻿', '').trim().split('\r\n')
  assert.equal(linhas[0], 'equipe;cidade;categoria;status;nº atletas;pendências;atualizado em;pagamento')
  assert.ok(linhas.some((l) => l.endsWith(';COMPROVANTE_ENVIADO')))
  assert.ok(linhas.some((l) => l.endsWith(';CONFIRMADO')))
  assert.ok(linhas.every((l, i) => i === 0 || l.split(';').length === 8), 'toda linha tem a coluna extra')
  assert.ok(!csv.match(/comprovante-pagamento|chave-pix|\.pdf/i), 'o CSV não leva comprovante nem chave Pix')
  // Outro organizador não vê estas inscrições.
  await como('org2')
  corpo = await json(await painelLista.GET(req('GET', '/api/organizador/inscricoes')))
  assert.ok(!corpo.data.itens.some((i: any) => i.ligaId === 1))

  // --- 11. Recursos ausentes = 503 (nunca 500) ------------------------------------------------------------------------------------------
  // Coluna da categoria ausente.
  t = novoBanco({}, { colunasAusentes: { CategoriaConfiguracao: ['pagamentoModo'] } })
  amb.colunasAusentes.CategoriaConfiguracao = ['pagamentoModo']
  await como('org1')
  for (const resposta of [await GET_CFG(IDS.CAT1), await PUT_CFG(IDS.CAT1, { modo: 'COMPROVANTE', valorCentavos: 100, pixChave: 'k' })]) {
    assert.equal(resposta.status, 503)
    assert.equal((await json(resposta)).error, 'Recurso ainda não habilitado neste ambiente.')
  }
  // Sem a coluna a categoria não cobra: aprovar segue funcionando e a lista não quebra.
  assert.equal((await APROVAR(INS.A)).status, 200)
  assert.equal((await painelLista.GET(req('GET', '/api/organizador/inscricoes'))).status, 200)
  await como('lider', 'equipe')
  assert.equal((await GET_LIDER(INS.A)).status, 200)
  assert.equal((await json(await GET_LIDER(INS.A))).data.exige, false)
  assert.equal((await ASSINAR(comprovante())).status, 503, 'upload exige a coluna')
  delete amb.colunasAusentes.CategoriaConfiguracao
  // Tabela do pagamento ausente.
  const semTabela = tabelas()
  delete (semTabela as any).PagamentoInscricao
  amb.banco.atual = bancoComTabelas(semTabela).banco
  await como('lider', 'equipe')
  r = await GET_LIDER(INS.A)
  assert.equal(r.status, 503)
  assert.equal((await json(r)).codigo, 'RECURSO_NAO_HABILITADO')
  assert.equal((await ASSINAR(comprovante())).status, 503)
  await como('org1')
  assert.equal((await GET_PAG(INS.A)).status, 503)
  assert.equal((await DECIDIR(INS.A, { decisao: 'ISENTAR' })).status, 503)
  assert.equal((await GET_URL(INS.A)).status, 503)
  assert.equal((await APROVAR(INS.A)).status, 503, 'não aprova às cegas')
  assert.equal((await GET_PAG(INS.SEM_COBRANCA)).status, 200, 'categoria sem cobrança não depende da tabela')
  r = await painelLista.GET(req('GET', '/api/organizador/inscricoes'))
  assert.equal(r.status, 200, 'a lista do painel não cai')
  assert.equal((await APROVAR(INS.SEM_COBRANCA)).status, 200)
  // A inscrição não falha se o pagamento não puder ser criado.
  assert.equal(await garantirPagamentoSemFalhar(INS.A), null)

  void nada
  console.log('pagamento-comprovante: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
