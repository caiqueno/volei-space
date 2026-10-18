// Ponte TimeClube -> Equipe legada (R14b): inscrever cria/reaproveita a Equipe e grava Inscricao.equipeLegadoId;
// com uma partida dessa equipe, GET /api/meu-time/jogos devolve o jogo e o banco por sessão abre (200).
// Também: idempotência, aprovação pelo organizador, reparo preguiçoso, degradação sem a coluna e escolha de atletas.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-equipe-legada-com-32-caracteres'

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
const C1 = uuid(1) // liga 1, AUTOMATICA (org-1)
const C3 = uuid(3) // liga 2, APROVACAO (org-2)
const C4 = uuid(4) // liga 1, AUTOMATICA, segunda categoria
const C5 = uuid(5) // liga 1, AUTOMATICA, terceira categoria
const EQ = uuid(8)
const EQ_OUTRA = uuid(9)
const CLUBE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLUBE_OUTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ATLETA_ALHEIO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const hora = (ms: number) => new Date(Date.now() + ms).toISOString()
const idAtleta = (i: number) => `0000000${i}-0000-4000-8000-000000000000`

function tabelas(): Record<string, LinhaEscrita[]> {
  const atletas = Array.from({ length: 6 }, (_, i) => ({
    id: idAtleta(i + 1), nome: `Atleta ${i + 1}`, dataNascimento: `199${i}-05-1${i}`, sexo: 'F', numeroPreferido: i + 1, cpfHash: 'x', mescladoParaId: null,
  }))
  const liga = (id: number, nome: string, organizadorId: string) => ({
    id, nome, organizadorId, status: 'ATIVA', simulacao: false, inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null,
  })
  const categoria = (id: string, ligaId: number, nome: string, extras: Record<string, unknown> = {}) => ({
    id, ligaId, codigo: 'FEMININO', nome, ordem: 0, tokenInscricao: null, removidaEm: null, ...extras,
  })
  return {
    Liga: [liga(1, 'Copa Norte', 'org-1'), liga(2, 'Copa Sul', 'org-2')],
    CategoriaCampeonato: [
      categoria(C1, 1, 'Adulto Feminino'),
      categoria(C3, 2, 'Livre Feminino', { modoInscricao: 'APROVACAO' }),
      categoria(C4, 1, 'Sub-19 Feminino'),
      categoria(C5, 1, 'Sub-17 Feminino'),
    ],
    CategoriaConfiguracao: [C1, C3, C4, C5].map((id) => ({ categoriaCampeonatoId: id, ligaId: 1, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null })),
    RegraElenco: [], LinkInscricaoCampeonato: [], ConviteEquipe: [],
    Clube: [{ id: CLUBE, nome: 'Clube A' }, { id: CLUBE_OUTRO, nome: 'Clube B' }],
    TimeClube: [
      { id: EQ, clubeId: CLUBE, nome: 'Equipe A', cidade: 'Belém', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
      { id: EQ_OUTRA, clubeId: CLUBE_OUTRO, nome: 'Equipe B', cidade: 'Manaus', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
    ],
    MembroEquipe: [
      { timeId: EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' },
      { timeId: EQ_OUTRA, usuarioId: 'outro', papel: 'RESPONSAVEL' },
    ],
    Atleta: atletas,
    VinculoAtletaClube: atletas.map((a) => ({ clubeId: CLUBE, atletaId: a.id, status: 'ATIVO' })),
    AtletaConsentimento: [],
    Inscricao: [], InscricaoAtleta: [], InscricaoComissao: [], ComissaoTime: [], SolicitacaoInscricao: [],
    Notificacao: [],
    Equipe: [], Jogador: [], Partida: [], SetPartida: [], SumulaPresenca: [], BancoAcesso: [], Papeleta: [], PedidoBanco: [],
  }
}

let dados: Record<string, LinhaEscrita[]>
function novoBanco(ajuste?: (t: Record<string, LinhaEscrita[]>) => void, opcoes: Record<string, unknown> = {}) {
  dados = tabelas()
  ajuste?.(dados)
  banco.atual = criarBancoEscrita(dados, {
    unicos: { Inscricao: [['categoriaCampeonatoId', 'timeId']], MembroEquipe: [['timeId', 'usuarioId']], Equipe: [['categoriaCampeonatoId', 'nome']] },
    padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, capitao: false, libero: false } },
    idsNumericos: ['Equipe', 'Jogador'],
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
  const como = async (userId: string, tipo: 'equipe' | 'organizador' = 'equipe') => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const solicitar = await import('../src/app/api/meu-time/campeonatos/solicitacoes/route')
  const decidir = await import('../src/app/api/organizador/solicitacoes/[id]/decidir/route')
  const jogos = await import('../src/app/api/meu-time/jogos/route')
  const visao = await import('../src/app/api/banco/sessao/[partidaId]/[equipeId]/route')
  const { garantirEquipeLegada, repararVinculosDoTime } = await import('../src/lib/meu-time/equipe-legada')

  process.env.MEU_TIME_ATIVO = '1'
  process.env.INSCRICAO_SOLICITACAO_ATIVO = '1'
  process.env.BANCO_SESSAO_ATIVO = '1'
  process.env.BANCO_APP_ATIVO = '1'

  const POST_SOLIC = (corpo: unknown) => solicitar.POST(req('POST', '/api/meu-time/campeonatos/solicitacoes', corpo))
  const POST_DECIDIR = (id: string, corpo: unknown) => decidir.POST(req('POST', `/x/${id}`, corpo), { params: Promise.resolve({ id }) })
  const GET_JOGOS = (timeId = EQ) => jogos.GET(req('GET', `/api/meu-time/jogos?equipeId=${timeId}`))
  const GET_BANCO = (partidaId: number, equipeId: number) =>
    visao.GET(req('GET', '/x'), { params: Promise.resolve({ partidaId: String(partidaId), equipeId: String(equipeId) }) } as any)

  // --- 1. Inscrição automática cria a Equipe legada e grava o vínculo ---------------------------------------------
  novoBanco()
  await como('lider')
  const r1 = await POST_SOLIC({ equipeId: EQ, categoriaId: C1 })
  assert.equal(r1.status, 201)
  const inscricaoId = (await json(r1)).data.inscricaoId as string
  assert.equal(dados.Equipe.length, 1)
  const eq = dados.Equipe[0]
  assert.equal(eq.nome, 'Equipe A')
  assert.equal(eq.categoria, 'FEMININO')
  assert.equal(eq.categoriaCampeonatoId, C1)
  assert.equal(eq.ligaId, 1)
  assert.equal(eq.serie, null)
  const insc = dados.Inscricao.find((i) => i.id === inscricaoId)!
  assert.equal(insc.equipeLegadoId, eq.id, 'vínculo gravado')
  assert.equal(dados.Jogador.length, 6, 'elenco copiado para o legado')
  assert.ok(dados.Jogador.every((j) => j.equipeId === eq.id))
  assert.ok(dados.InscricaoAtleta.every((a) => a.jogadorLegadoId != null))

  // --- 2. Partida com a equipe -> jogos e banco por sessão ----------------------------------------------------------
  dados.Equipe.push({ id: 900, nome: 'Rival', categoria: 'FEMININO', categoriaCampeonatoId: C1, ligaId: 1 })
  dados.Partida.push({
    id: 500, ligaId: 1, equipeAId: eq.id, equipeBId: 900, status: 'AGENDADA', categoriaCampeonatoId: C1,
    dataHora: hora(3_600_000), localNome: 'Ginásio', setsPorA: 0, setsPorB: 0,
  })
  reiniciarCotas()
  const rj = await GET_JOGOS()
  assert.equal(rj.status, 200)
  const lista = (await json(rj)).data as any[]
  assert.equal(lista.length, 1)
  assert.equal(lista[0].partidaId, 500)
  assert.equal(lista[0].equipeId, eq.id)
  assert.equal(lista[0].adversario, 'Rival')
  assert.equal((await GET_BANCO(500, Number(eq.id))).status, 200, 'banco por sessão abre')
  await como('outro')
  reiniciarCotas()
  assert.equal((await GET_BANCO(500, Number(eq.id))).status, 404, 'outro time não abre')
  await como('lider')

  // --- 3. Reexecução não duplica -----------------------------------------------------------------------------------------
  assert.equal(await garantirEquipeLegada(inscricaoId), eq.id)
  assert.equal(await garantirEquipeLegada(inscricaoId), eq.id)
  assert.equal(dados.Equipe.filter((e) => e.nome === 'Equipe A').length, 1)
  assert.equal(dados.Jogador.length, 6)
  reiniciarCotas()
  assert.equal((await POST_SOLIC({ equipeId: EQ, categoriaId: C1 })).status, 409)
  assert.equal(dados.Equipe.filter((e) => e.nome === 'Equipe A').length, 1)
  assert.equal(await garantirEquipeLegada('inexistente'), null, 'inscrição inexistente não lança')

  // --- 4. Aprovação pelo organizador reaproveita a Equipe do mesmo nome ----------------------------------------------------
  novoBanco((t) => {
    t.Equipe.push({ id: 700, nome: 'Equipe A', categoria: 'FEMININO', categoriaCampeonatoId: C3, ligaId: 2 })
  })
  await como('lider')
  reiniciarCotas()
  const r4 = await POST_SOLIC({ equipeId: EQ, categoriaId: C3 })
  assert.equal(r4.status, 201)
  assert.equal((await json(r4)).data.estado, 'PENDENTE')
  assert.equal(dados.Inscricao.length, 0)
  const solicitacaoId = dados.SolicitacaoInscricao[0].id as string
  await como('org-2', 'organizador')
  reiniciarCotas()
  const d4 = await POST_DECIDIR(solicitacaoId, { decisao: 'APROVADA' })
  assert.equal(d4.status, 200)
  assert.equal(dados.Inscricao.length, 1)
  assert.equal(dados.Inscricao[0].equipeLegadoId, 700, 'reaproveitou a Equipe legada existente')
  assert.equal(dados.Equipe.filter((e) => e.categoriaCampeonatoId === C3).length, 1)
  assert.equal((await POST_DECIDIR(solicitacaoId, { decisao: 'APROVADA' })).status, 200, 'repetir é idempotente')
  assert.equal(dados.Equipe.filter((e) => e.categoriaCampeonatoId === C3).length, 1)
  assert.equal(dados.Jogador.length, 6)

  // --- 5. Equipe de mesmo nome já ligada a outro time não é sequestrada ---------------------------------------------------
  novoBanco((t) => {
    t.TimeClube.push({ id: uuid(6), clubeId: CLUBE, nome: 'Equipe A', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null })
    t.Equipe.push({ id: 710, nome: 'Equipe A', categoria: 'FEMININO', categoriaCampeonatoId: C1, ligaId: 1 })
    t.Inscricao.push({ id: 'i-dono', timeId: uuid(6), ligaId: 1, categoriaCampeonatoId: C1, status: 'CONFIRMADA', equipeLegadoId: 710 })
    t.Inscricao.push({ id: 'i-novo', timeId: EQ, ligaId: 1, categoriaCampeonatoId: C4, status: 'CONFIRMADA', equipeLegadoId: null })
    t.Inscricao.push({ id: 'i-conf', timeId: EQ, ligaId: 1, categoriaCampeonatoId: C1, status: 'CONFIRMADA', equipeLegadoId: null })
  })
  assert.equal(await garantirEquipeLegada('i-conf'), null, 'dono diferente: não vincula')
  assert.equal(dados.Inscricao.find((i) => i.id === 'i-conf')!.equipeLegadoId, null)

  // --- 6. Reparo preguiçoso, idempotente e com limite -----------------------------------------------------------------------------
  novoBanco((t) => {
    for (const [i, cat] of [C1, C4, C5].entries()) {
      t.Inscricao.push({ id: `r${i}`, timeId: EQ, ligaId: 1, categoriaCampeonatoId: cat, status: 'CONFIRMADA', equipeLegadoId: null })
    }
    t.Inscricao.push({ id: 'rx', timeId: EQ, ligaId: 2, categoriaCampeonatoId: C3, status: 'REMOVIDA', equipeLegadoId: null })
  })
  assert.equal(await repararVinculosDoTime(EQ, 2), 2, 'respeita o limite')
  assert.equal(dados.Inscricao.filter((i) => i.equipeLegadoId != null).length, 2)
  assert.equal(await repararVinculosDoTime(EQ, 2), 1)
  assert.equal(await repararVinculosDoTime(EQ, 2), 0, 'nada a reparar')
  assert.equal(dados.Equipe.length, 3)
  assert.equal(dados.Inscricao.find((i) => i.id === 'rx')!.equipeLegadoId, null, 'removida não ganha equipe')

  // Reparo ao listar jogos: inscrição antiga sem vínculo passa a enxergar a partida.
  novoBanco((t) => {
    t.Inscricao.push({ id: 'ant', timeId: EQ, ligaId: 1, categoriaCampeonatoId: C1, status: 'CONFIRMADA', equipeLegadoId: null })
    t.Equipe.push({ id: 901, nome: 'Rival', categoria: 'FEMININO', categoriaCampeonatoId: C1, ligaId: 1 })
  })
  await como('lider')
  reiniciarCotas()
  assert.equal((await json(await GET_JOGOS())).data.length, 0)
  const idEquipe = dados.Inscricao[0].equipeLegadoId
  assert.ok(idEquipe != null, 'o reparo vinculou ao listar')
  dados.Partida.push({ id: 501, ligaId: 1, equipeAId: 901, equipeBId: idEquipe, status: 'AGENDADA', categoriaCampeonatoId: C1, dataHora: hora(7_200_000), localNome: 'Q1' })
  reiniciarCotas()
  assert.equal((await json(await GET_JOGOS())).data.length, 1)

  // --- 7. Sem a coluna: a inscrição segue (201) sem vínculo e sem 500 -------------------------------------------------------------
  novoBanco(undefined, { colunasAusentes: { Inscricao: ['equipeLegadoId'] } })
  await como('lider')
  reiniciarCotas()
  assert.equal((await POST_SOLIC({ equipeId: EQ, categoriaId: C1 })).status, 201)
  assert.equal(dados.Inscricao.length, 1)

  // --- 8. Escolha dos atletas (atletas?: string[]) ------------------------------------------------------------------------------------
  const comMax3 = (t: Record<string, LinhaEscrita[]>) => {
    t.RegraElenco.push({ categoriaCampeonatoId: C1, atletasMin: 1, atletasMax: 3, liberosMax: 2 })
    t.RegraElenco.push({ categoriaCampeonatoId: C3, atletasMin: 1, atletasMax: 3, liberosMax: 2 })
  }
  novoBanco(comMax3)
  await como('lider')
  reiniciarCotas()
  const sem = await POST_SOLIC({ equipeId: EQ, categoriaId: C1 })
  assert.equal(sem.status, 422)
  assert.equal((await json(sem)).codigo, 'ACIMA_DO_MAXIMO', 'sem o campo: seleção automática do banco inteiro')
  assert.equal((await POST_SOLIC({ equipeId: EQ, categoriaId: C1, atletas: ['nao-e-uuid'] })).status, 422)
  assert.equal((await POST_SOLIC({ equipeId: EQ, categoriaId: C1, atletas: [] })).status, 422)
  const fora = await POST_SOLIC({ equipeId: EQ, categoriaId: C1, atletas: [idAtleta(1), ATLETA_ALHEIO] })
  assert.equal(fora.status, 422)
  assert.equal((await json(fora)).codigo, 'ATLETA_FORA_DA_EQUIPE')
  assert.equal(dados.Inscricao.length, 0)
  const ok = await POST_SOLIC({ equipeId: EQ, categoriaId: C1, atletas: [idAtleta(2), idAtleta(4), idAtleta(6), idAtleta(2)] })
  assert.equal(ok.status, 201)
  assert.deepEqual(dados.InscricaoAtleta.map((a) => a.atletaId).sort(), [idAtleta(2), idAtleta(4), idAtleta(6)])
  assert.equal(dados.Jogador.length, 3)

  // Em categoria com aprovação a escolha espera a decisão do organizador.
  reiniciarCotas()
  const pend = await POST_SOLIC({ equipeId: EQ, categoriaId: C3, atletas: [idAtleta(1), idAtleta(3)] })
  assert.equal(pend.status, 201)
  assert.deepEqual(dados.SolicitacaoInscricao[0].atletasEscolhidos, [idAtleta(1), idAtleta(3)])
  await como('org-2', 'organizador')
  reiniciarCotas()
  assert.equal((await POST_DECIDIR(dados.SolicitacaoInscricao[0].id as string, { decisao: 'APROVADA' })).status, 200)
  const daC3 = dados.Inscricao.find((i) => i.categoriaCampeonatoId === C3)!
  assert.deepEqual(dados.InscricaoAtleta.filter((a) => a.inscricaoId === daC3.id).map((a) => a.atletaId).sort(), [idAtleta(1), idAtleta(3)])
  assert.ok(daC3.equipeLegadoId != null)

  console.log('equipe-legada.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
