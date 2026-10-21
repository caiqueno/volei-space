// Explorar competições (R18): só competições públicas e publicadas, filtros, paginação e o selo de elegibilidade
// (OK, AVISO, BLOQUEIO) calculado no servidor com o motivo em texto simples e sem dado pessoal.
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-explorar-com-32-caracteres-ok'

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
const CA = uuid(1) // feminina, mínimo 6, idade mínima 18
const CB = uuid(2) // masculina
const CC = uuid(3) // feminina sem regras, modo APROVACAO
const CD = uuid(4) // liga com inscrições encerradas
const CE = uuid(5) // lotada (máximo 1, já ocupada)
const CF = uuid(6) // já inscrita
const CG = uuid(7) // liga privada
const CH = uuid(8) // liga em rascunho
const CI = uuid(9) // liga finalizada
const EQ = '11111111-2222-4333-8444-555555555555'
const EQ_OUTRA = '66666666-2222-4333-8444-555555555555'
const CLUBE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLUBE_OUTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AGORA = new Date('2026-10-21T12:00:00Z')

function tabelas(): Record<string, LinhaEscrita[]> {
  const liga = (id: number, nome: string, organizadorId: string, extras: Record<string, unknown> = {}) => ({
    id, nome, organizadorId, status: 'ATIVA', simulacao: false, inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: '2099-01-01T00:00:00Z', dataInicio: null, dataFim: null, cidade: organizadorId === 'org-1' ? 'Belém' : 'Manaus', ...extras,
  })
  const cat = (id: string, ligaId: number, codigo: string, nome: string, extras: Record<string, unknown> = {}) => ({ id, ligaId, codigo, nome, ordem: 0, removidaEm: null, ...extras })
  const atletas = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `0000000${i + 1}-0000-4000-8000-000000000000`, nome: `Adulta Secreta ${i + 1}`, dataNascimento: '1990-05-05', sexo: 'F', cpfHash: 'cpf-secreto', mescladoParaId: null })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `0000000${i + 5}-0000-4000-8000-000000000000`, nome: `Menor Secreta ${i + 1}`, dataNascimento: '2015-05-05', sexo: 'F', cpfHash: 'cpf-secreto', mescladoParaId: null })),
  ]
  return {
    Liga: [
      liga(1, 'Copa Norte', 'org-1', { dataInicio: '2026-11-10T12:00:00Z', dataFim: '2026-11-20T12:00:00Z' }),
      liga(2, 'Copa Sul', 'org-2', { dataInicio: '2026-12-01T12:00:00Z', dataFim: '2026-12-10T12:00:00Z' }),
      liga(3, 'Copa Encerrada', 'org-1', { inscricoesAbertas: false }),
      liga(4, 'Copa Privada', 'org-1', { visibilidade: 'PRIVADA' }),
      liga(5, 'Copa Rascunho', 'org-1', { status: 'RASCUNHO' }),
      liga(6, 'Copa Finalizada', 'org-1', { status: 'FINALIZADO' }),
    ],
    CategoriaCampeonato: [
      cat(CA, 1, 'FEMININO', 'Adulto Feminino'),
      cat(CB, 1, 'MASCULINO', 'Adulto Masculino'),
      cat(CC, 2, 'FEMININO', 'Livre Feminino', { modoInscricao: 'APROVACAO' }),
      cat(CD, 3, 'FEMININO', 'Encerrada Feminina'),
      cat(CE, 2, 'FEMININO', 'Lotada Feminina'),
      cat(CF, 2, 'FEMININO', 'Inscrita Feminina'),
      cat(CG, 4, 'FEMININO', 'Privada Feminina'),
      cat(CH, 5, 'FEMININO', 'Rascunho Feminino'),
      cat(CI, 6, 'FEMININO', 'Finalizada Feminina'),
    ],
    CategoriaConfiguracao: [
      { categoriaCampeonatoId: CA, ligaId: 1, genero: 'FEMININO', idadeMinima: 18, idadeMaxima: null, quantidadeEquipesMaxima: 8, dataInicio: '2026-11-10T12:00:00Z', dataFim: '2026-11-12T12:00:00Z', inscricoesEncerramentoEm: '2026-11-01T12:00:00Z' },
      { categoriaCampeonatoId: CB, ligaId: 1, genero: 'MASCULINO', idadeMinima: null, idadeMaxima: null },
      { categoriaCampeonatoId: CE, ligaId: 2, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null, quantidadeEquipesMaxima: 1 },
    ],
    RegraElenco: [{ categoriaCampeonatoId: CA, atletasMin: 6, atletasMax: 14, liberosMax: 2, documentosExigidos: [] }],
    CandidaturaOrganizador: [
      { id: 'org-1', nome: 'Pessoa Um', email: 'um@volei.space', telefone: '91999990000', organizacao: 'Liga Norte', cidade: 'Belém' },
      { id: 'org-2', nome: 'Pessoa Dois', email: 'dois@volei.space', telefone: '92999990000', organizacao: null, cidade: 'Manaus' },
    ],
    LigaLocal: [{ ligaId: 1, nome: 'Ginásio Central', ordem: 1 }],
    TimeClube: [
      { id: EQ, clubeId: CLUBE, nome: 'Equipe A', cidade: 'Belém', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
      { id: EQ_OUTRA, clubeId: CLUBE_OUTRO, nome: 'Equipe B', cidade: 'Manaus', naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
    ],
    MembroEquipe: [
      { timeId: EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' },
      { timeId: EQ, usuarioId: 'assist', papel: 'ASSISTENTE' },
      { timeId: EQ_OUTRA, usuarioId: 'outro', papel: 'RESPONSAVEL' },
    ],
    Atleta: atletas,
    VinculoAtletaClube: atletas.map((a) => ({ clubeId: CLUBE, atletaId: a.id, status: 'ATIVO' })),
    Inscricao: [
      { id: 'i1', ligaId: 2, categoriaCampeonatoId: CE, timeId: EQ_OUTRA, status: 'CONFIRMADA' },
      { id: 'i2', ligaId: 2, categoriaCampeonatoId: CF, timeId: EQ, status: 'CONFIRMADA' },
    ],
  }
}

function novoBanco(t: Record<string, LinhaEscrita[]>) {
  banco.atual = criarBancoEscrita(t)
}

function req(caminho: string) {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, { method: 'GET', headers: { 'x-forwarded-for': '9.9.9.9' } })
}
const json = async (r: Response) => (await r.json()) as any

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { calcularSelo } = await import('../src/lib/explorar-competicoes/selo')
  const { REGRA_ELENCO_PADRAO } = await import('../src/lib/meu-time/regras')
  const { listarCompeticoes } = await import('../src/lib/explorar-competicoes/servico')
  const como = async (userId: string, tipo: 'equipe' | 'organizador' | 'arbitro' = 'equipe') => {
    reiniciarCotas()
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const rota = await import('../src/app/api/meu-time/competicoes/route')
  const GET = (consulta = '') => rota.GET(req(`/api/meu-time/competicoes${consulta}`))
  const porCategoria = (resposta: any, id: string) => resposta.data.itens.find((i: any) => i.categoriaId === id)

  // --- 0. Selo (função pura) ----------------------------------------------------------------------------------
  const atleta = (id: string, nascimento: string | null) => ({ id, nome: '', dataNascimento: nascimento, sexo: 'F', temDocumento: true })
  const base = {
    naipeEquipe: 'FEMININO' as const, atletas: [atleta('1', '1990-01-01'), atleta('2', '1990-01-01')], naipeCategoria: 'FEMININO',
    regra: { ...REGRA_ELENCO_PADRAO, atletasMin: 2 }, elegibilidade: null, janelaAberta: true, vagasRestantes: 3, jaInscrita: false, hoje: AGORA,
  }
  assert.deepEqual(calcularSelo(base), { nivel: 'OK', texto: 'Seu time pode participar', detalhes: [] })
  assert.equal(calcularSelo({ ...base, naipeEquipe: null }).nivel, 'AVISO')
  assert.deepEqual(calcularSelo({ ...base, naipeCategoria: 'MASCULINO' }), { nivel: 'BLOQUEIO', texto: 'Competição só para o naipe masculino', detalhes: ['O naipe do seu time é feminino.'] })
  assert.equal(calcularSelo({ ...base, naipeCategoria: 'MISTO' }).nivel, 'OK')
  assert.equal(calcularSelo({ ...base, naipeCategoria: null }).nivel, 'OK')
  assert.equal(calcularSelo({ ...base, janelaAberta: false, janelaMotivo: 'As inscrições já foram encerradas.' }).texto, 'Inscrições encerradas')
  assert.equal(calcularSelo({ ...base, vagasRestantes: 0 }).nivel, 'BLOQUEIO')
  assert.equal(calcularSelo({ ...base, atletas: [] }).nivel, 'AVISO')
  assert.equal(calcularSelo({ ...base, regra: { ...base.regra, atletasMin: 5 } }).texto, 'Faltam 3 atletas para o mínimo de 5')
  assert.equal(calcularSelo({ ...base, regra: { ...base.regra, atletasMin: 3 } }).texto, 'Faltam 1 atleta para o mínimo de 3')
  assert.equal(calcularSelo({ ...base, jaInscrita: true, vagasRestantes: 0 }).nivel, 'OK', 'quem já está dentro não é bloqueado')
  const semNascimento = calcularSelo({ ...base, atletas: [atleta('1', null), atleta('2', '1990-01-01')], elegibilidade: { genero: 'FEMININO', idadeMinima: 18, idadeMaxima: null } })
  assert.equal(semNascimento.nivel, 'AVISO')
  assert.equal(semNascimento.texto, 'Confira a data de nascimento dos atletas')

  // --- 1. Flags e autenticação ------------------------------------------------------------------------------------------
  novoBanco(tabelas())
  delete process.env.EXPLORAR_COMPETICOES_ATIVO
  process.env.MEU_TIME_ATIVO = '1'
  await como('lider')
  assert.equal((await GET(`?equipeId=${EQ}`)).status, 404)
  process.env.EXPLORAR_COMPETICOES_ATIVO = '1'
  delete process.env.MEU_TIME_ATIVO
  assert.equal((await GET(`?equipeId=${EQ}`)).status, 404, 'Meu Time desligado também esconde')
  process.env.MEU_TIME_ATIVO = '1'
  sessao.token = null
  assert.equal((await GET()).status, 401)
  await como('arb', 'arbitro')
  assert.equal((await GET()).status, 401)
  await como('org-1', 'organizador')
  assert.equal((await GET()).status, 401, 'só conta de equipe')

  // --- 2. Só públicas e publicadas; formato do item -----------------------------------------------------------------------------
  const t = tabelas()
  novoBanco(t)
  await como('lider')
  const r1 = await GET(`?equipeId=${EQ}`)
  assert.equal(r1.status, 200)
  const c1 = await json(r1)
  const ids = c1.data.itens.map((i: any) => i.categoriaId).sort()
  assert.deepEqual(ids, [CA, CB, CC, CD, CE, CF].sort(), 'sem privada, rascunho nem finalizada')
  assert.equal(c1.data.total, 6)
  const a = porCategoria(c1, CA)
  assert.deepEqual(Object.keys(a).sort(), ['campeonato', 'categoria', 'categoriaId', 'cidade', 'fim', 'inicio', 'ligaId', 'local', 'modo', 'naipe', 'organizador', 'prazoInscricao', 'privada', 'selo', 'situacao', 'vagasRestantes', 'vagasTotal', 'valorInscricao'])
  assert.deepEqual(
    { campeonato: a.campeonato, organizador: a.organizador, categoria: a.categoria, naipe: a.naipe, cidade: a.cidade, local: a.local, inicio: a.inicio, fim: a.fim, prazoInscricao: a.prazoInscricao, vagasTotal: a.vagasTotal, vagasRestantes: a.vagasRestantes, valorInscricao: a.valorInscricao, modo: a.modo, situacao: a.situacao, privada: a.privada },
    { campeonato: 'Copa Norte', organizador: 'Liga Norte', categoria: 'Adulto Feminino', naipe: 'FEMININO', cidade: 'Belém', local: 'Ginásio Central', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-12T12:00:00Z', prazoInscricao: '2026-11-01T12:00:00Z', vagasTotal: 8, vagasRestantes: 8, valorInscricao: null, modo: 'AUTOMATICA', situacao: 'ABERTA', privada: false },
  )
  assert.equal(porCategoria(c1, CC).modo, 'APROVACAO')
  assert.equal(porCategoria(c1, CC).organizador, 'Pessoa Dois', 'sem nome de organização usa o nome da conta')
  const texto = JSON.stringify(c1)
  assert.ok(!/Secret|cpf|volei\.space|99999|organizadorId|tokenInscricao|visibilidade/.test(texto), 'sem dado pessoal, e-mail, telefone ou campo interno')

  // --- 3. Selo por situação ----------------------------------------------------------------------------------------------------------
  assert.deepEqual(a.selo, {
    nivel: 'AVISO',
    texto: 'Faltam 2 atletas na idade permitida',
    detalhes: ['4 de 6 atletas do time atendem às regras da categoria.', '2 atletas estão fora da idade ou do naipe da categoria.'],
  })
  assert.deepEqual(porCategoria(c1, CB).selo, { nivel: 'BLOQUEIO', texto: 'Competição só para o naipe masculino', detalhes: ['O naipe do seu time é feminino.'] })
  assert.deepEqual(porCategoria(c1, CC).selo, { nivel: 'OK', texto: 'Seu time pode participar', detalhes: [] })
  const d = porCategoria(c1, CD)
  assert.equal(d.situacao, 'ENCERRADA')
  assert.equal(d.selo.nivel, 'BLOQUEIO')
  assert.equal(d.selo.texto, 'Inscrições encerradas')
  const e = porCategoria(c1, CE)
  assert.deepEqual({ vagasTotal: e.vagasTotal, vagasRestantes: e.vagasRestantes, situacao: e.situacao, nivel: e.selo.nivel }, { vagasTotal: 1, vagasRestantes: 0, situacao: 'LOTADA', nivel: 'BLOQUEIO' })
  const f = porCategoria(c1, CF)
  assert.deepEqual({ situacao: f.situacao, nivel: f.selo.nivel, texto: f.selo.texto }, { situacao: 'INSCRITA', nivel: 'OK', texto: 'Seu time já está inscrito nesta categoria' })
  // Sem equipe escolhida o selo avisa em vez de adivinhar.
  const semEquipe = await json(await GET())
  assert.equal(semEquipe.data.itens.length, 6)
  assert.ok(semEquipe.data.itens.every((i: any) => i.selo === null), 'sem equipeId o selo vem null')
  // Sem coluna de cidade no banco o filtro é ignorado, sem erro, e a cidade vem null.
  const semCidade = tabelas()
  semCidade.Liga.forEach((l) => delete l.cidade)
  novoBanco(semCidade)
  const rc = await json(await GET(`?equipeId=${EQ}&cidade=belem`))
  assert.equal(rc.data.total, 6)
  assert.ok(rc.data.itens.every((i: any) => i.cidade === null))
  novoBanco(t)

  // --- 4. Posse da equipe e papéis ----------------------------------------------------------------------------------------------------------
  await como('outro')
  assert.equal((await GET(`?equipeId=${EQ}`)).status, 404, 'equipe alheia = 404')
  assert.equal((await GET('?equipeId=nao-e-uuid')).status, 404)
  await como('assist')
  assert.equal((await GET(`?equipeId=${EQ}`)).status, 200, 'assistente também explora')

  // --- 5. Filtros e paginação ---------------------------------------------------------------------------------------------------------------------
  await como('lider')
  const ids2 = async (consulta: string) => ((await json(await GET(`?equipeId=${EQ}${consulta}`))).data.itens as any[]).map((i) => i.categoriaId).sort()
  assert.deepEqual(await ids2('&naipe=MASCULINO'), [CB])
  assert.deepEqual(await ids2('&naipe=feminino'), [CA, CC, CD, CE, CF].sort())
  assert.deepEqual(await ids2('&cidade=manaus'), [CC, CE, CF].sort(), 'cidade sem acento e sem maiúsculas')
  assert.deepEqual(await ids2('&cidade=belem'), [CA, CB, CD].sort())
  assert.deepEqual(await ids2('&abertas=1'), [CA, CB, CC].sort(), 'abertas: janela aberta e com vaga, fora as já inscritas')
  assert.deepEqual(await ids2('&q=copa%20norte'), [CA, CB].sort())
  assert.deepEqual(await ids2('&q=liga%20norte'), [CA, CB, CD].sort(), 'busca também pelo nome do organizador')
  assert.deepEqual(await ids2('&categoria=livre'), [CC])
  assert.deepEqual(await ids2('&de=2026-12-05&ate=2026-12-31'), [CC, CE, CF].sort())
  assert.deepEqual(await ids2('&de=2026-11-15&ate=2026-11-30'), [CB], 'só o que cai no período (CA termina em 12/11; CB herda as datas da liga)')
  assert.deepEqual(await ids2('&ate=2026-11-05'), [], 'sem datas ou depois do período fica de fora')
  assert.equal((await GET('?naipe=XPTO')).status, 422)
  assert.equal((await GET('?de=2026-13-45')).status, 422)
  assert.equal((await GET('?ate=amanha')).status, 422)
  assert.equal((await GET('?pagina=0')).status, 422)
  assert.equal((await json(await GET(`?equipeId=${EQ}&pagina=2`))).data.itens.length, 0)
  const pagina1 = await json(await GET(`?equipeId=${EQ}&pagina=1`))
  assert.equal(pagina1.data.total, 6)
  // Ordenação: por início (sem data por último), depois nome.
  assert.equal(pagina1.data.itens[0].categoriaId, CA)

  // O serviço aceita um relógio: janela futura vira EM_BREVE.
  const futuro = tabelas()
  futuro.Liga[0].inscricoesAberturaEm = '2027-01-01T00:00:00Z'
  novoBanco(futuro)
  const emBreve = await listarCompeticoes('lider', { equipeId: EQ }, AGORA)
  assert.equal(emBreve.itens.find((i) => i.categoriaId === CA)!.situacao, 'EM_BREVE')

  // --- 6. Tabela ausente = 503 -----------------------------------------------------------------------------------------------------------------------
  const sem = tabelas()
  delete (sem as any).CategoriaCampeonato
  novoBanco(sem)
  const s503 = await GET(`?equipeId=${EQ}`)
  assert.equal(s503.status, 503)
  assert.equal((await json(s503)).error, 'Recurso ainda não habilitado neste ambiente.')
  const semLiga = tabelas()
  delete (semLiga as any).Liga
  novoBanco(semLiga)
  assert.equal((await GET(`?equipeId=${EQ}`)).status, 503)

  console.log('explorar-competicoes.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
