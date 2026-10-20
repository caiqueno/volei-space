// Porta de entrada dos links legados para o Meu Time (R15): GET /api/inscricao/entrada/[token],
// convite na vitrine e na solicitação, flag, resposta uniforme e ausência de PII.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-entrada-com-32-caracteres'

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
const C1 = uuid(1) // liga 1 pública, token de categoria
const C2 = uuid(2) // liga 1 pública, sem token, APROVACAO
const C3 = uuid(3) // liga 3 privada, token de categoria
const C4 = uuid(4) // liga 3 privada, sem token
const C5 = uuid(5) // liga 4 rascunho
const C6 = uuid(6) // liga 5 com inscrições encerradas
const EQ = uuid(8)
const CLUBE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const TOK_CAT = 'tokcategoria0001'
const TOK_PRIV = 'tokprivada000003'
const TOK_RASC = 'tokrascunho00005'
const TOK_LINK_PUB = 'linkpublico000001'
const TOK_LINK_PRIV = 'linkprivado000003'
const TOK_LINK_OFF = 'linkdesativado001'
const TOK_LINK_REV = 'linkrevogado0001'
const TOK_LINK_EXP = 'linkexpirado0001'
const TOK_VAGA = 'vagatoken0000001'
const TOK_VAGA_PRIV = 'vagatoken0000003'
const TOK_FECHADA = 'tokfechada000006'

function tabelas(): Record<string, LinhaEscrita[]> {
  const atletas = Array.from({ length: 6 }, (_, i) => ({
    id: `0000000${i + 1}-0000-4000-8000-000000000000`,
    nome: `Atleta Secreto ${i + 1}`,
    dataNascimento: `199${i}-05-1${i}`,
    sexo: 'F',
    numeroPreferido: i + 1,
    cpfHash: 'cpf-secreto',
    mescladoParaId: null,
  }))
  const liga = (id: number, nome: string, extras: Record<string, unknown> = {}) => ({
    id, nome, organizadorId: 'org-segredo', status: 'ATIVA', simulacao: false, inscricoesAbertas: true,
    inscricoesAberturaEm: '2026-01-01T00:00:00Z', inscricoesEncerramentoEm: '2099-12-31T00:00:00Z', ...extras,
  })
  const categoria = (id: string, ligaId: number, codigo: string, nome: string, extras: Record<string, unknown> = {}) => ({
    id, ligaId, codigo, nome, ordem: 0, tokenInscricao: null, removidaEm: null, ...extras,
  })
  return {
    Liga: [
      liga(1, 'Copa Norte'),
      liga(3, 'Copa Privada', { visibilidade: 'PRIVADA' }),
      liga(4, 'Copa Rascunho', { status: 'RASCUNHO' }),
      liga(5, 'Copa Fechada', { status: 'FINALIZADO', inscricoesAbertas: false }),
      liga(6, 'Copa Simulada', { simulacao: true }),
    ],
    CategoriaCampeonato: [
      categoria(C1, 1, 'FEMININO', 'Adulto Feminino', { tokenInscricao: TOK_CAT }),
      categoria(C2, 1, 'MASCULINO', 'Adulto Masculino', { ordem: 1, modoInscricao: 'APROVACAO' }),
      categoria(C3, 3, 'FEMININO', 'Privada Feminina', { tokenInscricao: TOK_PRIV }),
      categoria(C4, 3, 'FEMININO', 'Privada Sub-19', { ordem: 1 }),
      categoria(C5, 4, 'FEMININO', 'Rascunho', { tokenInscricao: TOK_RASC }),
      categoria(C6, 5, 'FEMININO', 'Fechada', { tokenInscricao: TOK_FECHADA }),
    ],
    CategoriaConfiguracao: [C1, C2, C3, C4].map((id) => ({ categoriaCampeonatoId: id, ligaId: 1, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null })),
    LinkInscricaoCampeonato: [
      { id: 'l1', ligaId: 1, token: TOK_LINK_PUB, ativo: true, revogadoEm: null, expiraEm: null },
      { id: 'l2', ligaId: 3, token: TOK_LINK_PRIV, ativo: true, revogadoEm: null, expiraEm: null },
      { id: 'l3', ligaId: 1, token: TOK_LINK_OFF, ativo: false, revogadoEm: null, expiraEm: null },
      { id: 'l4', ligaId: 1, token: TOK_LINK_REV, ativo: true, revogadoEm: '2026-02-01T00:00:00Z', expiraEm: null },
      { id: 'l5', ligaId: 1, token: TOK_LINK_EXP, ativo: true, revogadoEm: null, expiraEm: '2020-01-01T00:00:00Z' },
    ],
    ConviteVagaEquipe: [
      { id: 'v1', ligaId: 1, categoriaCampeonatoId: C1, vaga: 1, token: TOK_VAGA, inscricaoRascunhoId: null, equipeId: null },
      { id: 'v2', ligaId: 3, categoriaCampeonatoId: C3, vaga: 1, token: TOK_VAGA_PRIV, inscricaoRascunhoId: null, equipeId: null },
    ],
    RegraElenco: [], ConviteEquipe: [],
    Clube: [{ id: CLUBE, nome: 'Clube A' }],
    TimeClube: [{ id: EQ, clubeId: CLUBE, nome: 'Equipe A', cidade: 'Belém', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null }],
    MembroEquipe: [{ timeId: EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' }],
    Atleta: atletas,
    VinculoAtletaClube: atletas.map((a) => ({ clubeId: CLUBE, atletaId: a.id, status: 'ATIVO' })),
    AtletaConsentimento: [],
    Inscricao: [], InscricaoAtleta: [], InscricaoComissao: [], ComissaoTime: [],
    SolicitacaoInscricao: [], Notificacao: [],
  }
}

function novoBanco(t: Record<string, LinhaEscrita[]>) {
  banco.atual = criarBancoEscrita(t, {
    unicos: { Inscricao: [['categoriaCampeonatoId', 'timeId']], MembroEquipe: [['timeId', 'usuarioId']] },
    padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, capitao: false, libero: false } },
  })
}

function req(metodo: string, caminho: string, corpo?: unknown, ip = '9.9.9.9') {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
const json = async (r: Response) => (await r.json()) as any

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const entrada = await import('../src/app/api/inscricao/entrada/[token]/route')
  const vitrine = await import('../src/app/api/meu-time/campeonatos/route')
  const solicitar = await import('../src/app/api/meu-time/campeonatos/solicitacoes/route')
  const como = async (userId: string) => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo: 'equipe', status: 'ATIVA', trocarSenha: false })
  }
  const PORTA = (token: string, ip?: string) => entrada.GET(req('GET', `/api/inscricao/entrada/${token}`, undefined, ip), { params: Promise.resolve({ token }) })
  const VITRINE = (consulta = '') => vitrine.GET(req('GET', `/api/meu-time/campeonatos?equipeId=${EQ}${consulta}`))
  const SOLICITAR = (corpo: unknown) => solicitar.POST(req('POST', '/api/meu-time/campeonatos/solicitacoes', corpo))

  const t = tabelas()
  novoBanco(t)

  // --- 1. Flag desligada: 404 ------------------------------------------------------------------------------
  delete process.env.INSCRICAO_VIA_MEU_TIME_ATIVO
  assert.equal((await PORTA(TOK_CAT)).status, 404)
  assert.equal((await PORTA('qualquer-coisa-aqui')).status, 404, 'desligada não revela nem a existência do token')

  process.env.INSCRICAO_VIA_MEU_TIME_ATIVO = '1'
  reiniciarCotas()

  // --- 2. Token de categoria (pública): dados sem PII ----------------------------------------------------------
  const porCat = await PORTA(TOK_CAT)
  assert.equal(porCat.status, 200)
  assert.equal(porCat.headers.get('cache-control'), 'no-store')
  const dCat = (await json(porCat)).data
  assert.deepEqual(dCat, {
    tipo: 'CATEGORIA',
    campeonato: 'Copa Norte',
    ligaId: 1,
    categorias: [{
      categoriaId: C1, nome: 'Adulto Feminino', naipe: 'FEMININO', modoInscricao: 'AUTOMATICA',
      periodo: { abre: '2026-01-01T00:00:00Z', fecha: '2099-12-31T00:00:00Z' }, situacao: 'ABERTA',
    }],
    privada: false,
  })
  const bruto = JSON.stringify(dCat)
  assert.ok(!bruto.includes(TOK_CAT) && !bruto.includes('org-segredo') && !bruto.includes('organizador'), 'sem token nem dados do organizador')
  assert.ok(!('conviteTokenParaApi' in dCat), 'pública não precisa de convite')

  // --- 3. Token do campeonato: todas as categorias ---------------------------------------------------------------
  const dLink = (await json(await PORTA(TOK_LINK_PUB))).data
  assert.equal(dLink.tipo, 'CAMPEONATO')
  assert.deepEqual(dLink.categorias.map((c: any) => [c.categoriaId, c.modoInscricao]), [[C1, 'AUTOMATICA'], [C2, 'APROVACAO']])
  assert.ok(!JSON.stringify(dLink).includes(TOK_LINK_PUB))

  // --- 4. Token de vaga: só a categoria da vaga, sem vaga/rascunho -------------------------------------------------
  const dVaga = (await json(await PORTA(TOK_VAGA))).data
  assert.equal(dVaga.tipo, 'VAGA')
  assert.deepEqual(dVaga.categorias.map((c: any) => c.categoriaId), [C1])
  assert.ok(!JSON.stringify(dVaga).includes(TOK_VAGA) && !('vaga' in dVaga))

  // --- 5. Inválido, desativado, revogado, expirado, rascunho, inexistente: resposta idêntica -----------------------------
  const referencia = await PORTA('naoexiste0000000')
  assert.equal(referencia.status, 404)
  const corpoRef = await json(referencia)
  for (const token of [TOK_LINK_OFF, TOK_LINK_REV, TOK_LINK_EXP, TOK_RASC, 'x', 'com espaco e %$#', 'a'.repeat(300)]) {
    const r = await PORTA(token)
    assert.equal(r.status, 404, token)
    assert.deepEqual(await json(r), corpoRef, `resposta uniforme para ${token.slice(0, 20)}`)
  }

  // --- 6. Período: campeonato encerrado devolve ENCERRADA (token válido) ---------------------------------------------------
  const dFechada = (await json(await PORTA(TOK_FECHADA))).data
  assert.equal(dFechada.categorias[0].situacao, 'ENCERRADA')
  t.Liga[0].inscricoesAberturaEm = '2999-01-01T00:00:00Z'
  assert.equal((await json(await PORTA(TOK_CAT))).data.categorias[0].situacao, 'FECHADA', 'ainda não abriu')
  t.Liga[0].inscricoesAberturaEm = '2026-01-01T00:00:00Z'

  // --- 7. Privada: convite só com token que dá direito ------------------------------------------------------------------
  const dPrivCat = (await json(await PORTA(TOK_PRIV))).data
  assert.equal(dPrivCat.privada, true)
  assert.equal(dPrivCat.conviteTokenParaApi, TOK_PRIV)
  assert.deepEqual(dPrivCat.categorias.map((c: any) => c.categoriaId), [C3])
  const dPrivLink = (await json(await PORTA(TOK_LINK_PRIV))).data
  assert.equal(dPrivLink.tipo, 'CAMPEONATO')
  assert.equal(dPrivLink.conviteTokenParaApi, TOK_LINK_PRIV)
  assert.deepEqual(dPrivLink.categorias.map((c: any) => c.categoriaId), [C3, C4])
  const dPrivVaga = (await json(await PORTA(TOK_VAGA_PRIV))).data
  assert.equal(dPrivVaga.privada, true)
  assert.ok(!('conviteTokenParaApi' in dPrivVaga), 'vaga não é convite aceito pelas regras atuais')

  // --- 8. Limite por IP ------------------------------------------------------------------------------------------------------
  reiniciarCotas()
  let ultimo = 200
  for (let i = 0; i < 40; i += 1) ultimo = (await PORTA(TOK_CAT, '7.7.7.7')).status
  assert.equal(ultimo, 429)
  const limitada = await PORTA(TOK_CAT, '7.7.7.7')
  assert.ok(limitada.headers.get('retry-after'))
  assert.equal((await PORTA(TOK_CAT, '8.8.8.8')).status, 200, 'outro IP segue livre')
  reiniciarCotas()

  // --- 9. Vitrine: privada só com convite válido ---------------------------------------------------------------------------------
  process.env.MEU_TIME_ATIVO = '1'
  process.env.INSCRICAO_SOLICITACAO_ATIVO = '1'
  await como('lider')
  const ids = async (consulta = '') => ((await json(await VITRINE(consulta))).data as any[]).map((l) => l.categoriaId).sort()
  assert.deepEqual(await ids(), [C1].sort(), 'sem convite: privada fora; masculina fora pelo naipe')
  assert.deepEqual(await ids(`&convite=${TOK_PRIV}`), [C1, C3].sort(), 'token de categoria abre só a categoria dele')
  assert.deepEqual(await ids(`&convite=${TOK_LINK_PRIV}`), [C1, C3, C4].sort(), 'link do campeonato abre as categorias da privada')
  assert.deepEqual(await ids(`&convite=${TOK_LINK_PRIV}&categoriaId=${C4}`), [C1, C4].sort(), 'categoriaId afunila a privada')
  assert.deepEqual(await ids(`&convite=${TOK_VAGA_PRIV}`), [C1], 'token de vaga não abre privada')
  assert.deepEqual(await ids('&convite=lixo-qualquer'), [C1], 'convite inválido é ignorado, sem erro')
  assert.deepEqual(await ids(`&convite=${TOK_CAT}`), [C1], 'convite de competição pública não muda nada')
  delete process.env.INSCRICAO_VIA_MEU_TIME_ATIVO
  assert.deepEqual(await ids(`&convite=${TOK_PRIV}`), [C1], 'flag desligada: parâmetro ignorado, fluxo legado')
  process.env.INSCRICAO_VIA_MEU_TIME_ATIVO = '1'

  // --- 10. Solicitação reaproveita o convite da porta -----------------------------------------------------------------------------
  reiniciarCotas()
  const semConvite = await SOLICITAR({ equipeId: EQ, categoriaId: C3 })
  assert.equal(semConvite.status, 403)
  assert.equal((await json(semConvite)).codigo, 'CONVITE_OBRIGATORIO')
  const vagaComoConvite = await SOLICITAR({ equipeId: EQ, categoriaId: C3, convite: TOK_VAGA_PRIV })
  assert.equal(vagaComoConvite.status, 403)
  assert.equal((await json(vagaComoConvite)).codigo, 'CONVITE_INVALIDO')
  assert.equal(t.Inscricao.length, 0)
  // Token de categoria da porta, usado exatamente como veio em conviteTokenParaApi.
  const ok = await SOLICITAR({ equipeId: EQ, categoriaId: C3, convite: dPrivCat.conviteTokenParaApi })
  assert.equal(ok.status, 201)
  assert.equal((await json(ok)).data.estado, 'INSCRITA')
  assert.equal(t.Inscricao.length, 1)
  // Link do campeonato da porta vale para outra categoria da mesma privada.
  const ok2 = await SOLICITAR({ equipeId: EQ, categoriaId: C4, convite: dPrivLink.conviteTokenParaApi })
  assert.equal(ok2.status, 201)
  assert.equal(t.Inscricao.length, 2)

  // --- 11. Paridade com o capitão: escudo só por https (sem javascript:, data:, http:, credenciais) ------------------------
  const detalhe = await import('../src/app/api/meu-time/equipes/[id]/route')
  const PATCH_EQUIPE = (corpo: unknown) => detalhe.PATCH(req('PATCH', '/x', corpo), { params: { id: EQ } })
  for (const ruim of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'http://exemplo.com/e.png', 'https://u:s@exemplo.com/e.png', 'ftp://x/e.png']) {
    assert.equal((await PATCH_EQUIPE({ escudoUrl: ruim })).status, 422, ruim)
  }
  assert.equal((await PATCH_EQUIPE({ escudoUrl: 'https://exemplo.com/e.png' })).status, 200)
  assert.equal((await PATCH_EQUIPE({ escudoUrl: null })).status, 200, 'remover o escudo continua valendo')

  console.log('inscricao-entrada.test: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
