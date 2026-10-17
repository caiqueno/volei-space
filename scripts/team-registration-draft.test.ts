/// <reference types="node" />
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  canEditRegistration,
  canEditRoster,
  registrationWindowDecision,
  type RegistrationDraft,
  type RegistrationLeague,
} from '../src/lib/team-registration-draft'
import { formularioDaInscricao, pendenciasDoAtleta, resolveFormularioRapidaConfig } from '../src/lib/inscricao-rapida'
import { getDefaultFormularioInscricaoConfig } from '../src/lib/championship-setup-defaults'
import { criarJogadorInscricaoRascunhoSchema, jogadorSchema, playerInscricaoSchema } from '../src/lib/schemas'

const now = new Date('2026-09-18T12:00:00.000Z')

function league(overrides: Partial<RegistrationLeague> = {}): RegistrationLeague {
  return {
    id: 10,
    nome: 'Liga de teste',
    status: 'ATIVA',
    inscricoesAbertas: true,
    inscricoesAberturaEm: null,
    inscricoesEncerramentoEm: null,
    inscricaoAprovacaoAutomatica: false,
    inscricaoPermiteEdicaoAposEnvio: true,
    inscricaoPrazoEdicaoDias: 7,
    elencoQuantidadeMinima: 1,
    elencoQuantidadeMaxima: 20,
    elencoCadastroDuranteInscricao: true,
    elencoCadastroAposAprovacao: true,
    prazoAlteracaoElencoDias: 7,
    quantidadeEquipes: 8,
    formularioInscricaoConfig: null,
    categoriasConfig: null,
    ...overrides,
  }
}

function draft(overrides: Partial<RegistrationDraft> = {}): RegistrationDraft {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ligaId: 10,
    nomeEquipe: 'Vôlei Teste',
    logoUrl: null,
    lider: null,
    tecnico: null,
    categoria: 'MISTO',
    serie: 'OURO',
    status: 'RASCUNHO',
    equipeId: null,
    inscricaoCampeonatoId: null,
    criadaEm: '2026-09-17T12:00:00.000Z',
    atualizadaEm: '2026-09-17T12:00:00.000Z',
    enviadaEm: null,
    ...overrides,
  }
}

function testRegistrationWindow() {
  assert.equal(registrationWindowDecision(league(), now).allowed, true)
  assert.equal(registrationWindowDecision(league({ status: 'EM_BREVE' }), now).allowed, true)
  assert.equal(registrationWindowDecision(league({ status: 'ENCERRADA' }), now).allowed, false)
  assert.equal(registrationWindowDecision(league({ inscricoesAberturaEm: '2026-09-19T00:00:00.000Z' }), now).allowed, false)
  assert.equal(registrationWindowDecision(league({ inscricoesEncerramentoEm: '2026-09-17T00:00:00.000Z' }), now).allowed, false)
  assert.equal(registrationWindowDecision(league({ inscricoesAbertas: false }), now).allowed, false)
}

function testEditRules() {
  const sent = draft({ status: 'ENVIADA', enviadaEm: '2026-09-15T12:00:00.000Z', equipeId: 42, inscricaoCampeonatoId: 'registration-1' })
  const closed = league({ inscricoesAbertas: false })
  assert.equal(canEditRegistration(draft(), closed, now).allowed, false)
  assert.equal(canEditRegistration(sent, league(), now).allowed, true)
  assert.equal(canEditRegistration(sent, closed, now).allowed, true)
  assert.equal(canEditRegistration(sent, league({ inscricaoPermiteEdicaoAposEnvio: false }), now).allowed, false)
  assert.equal(canEditRegistration(sent, league({ inscricaoPrazoEdicaoDias: 2 }), now).allowed, false)
  assert.equal(canEditRegistration(sent, league({ inscricaoPrazoEdicaoDias: 3 }), now).allowed, true)
  assert.equal(canEditRoster(sent, league({ elencoCadastroAposAprovacao: false }), 'APROVADA', now).allowed, false)
  assert.equal(canEditRoster(sent, league({ prazoAlteracaoElencoDias: 2 }), 'SOLICITADA', now).allowed, false)
  assert.equal(canEditRoster(draft(), league({ elencoCadastroDuranteInscricao: false }), null, now).allowed, false)
}

function testMigrationContract() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '202609200015_inscricao-equipe-rascunho.sql'), 'utf8')
  assert.match(sql, /create table if not exists public\."InscricaoEquipeRascunho"/)
  assert.match(sql, /create table if not exists public\."InscricaoEquipeJogadorRascunho"/)
  assert.match(sql, /token uuid not null unique default gen_random_uuid\(\)/)
  assert.match(sql, /for update/)
  assert.match(sql, /if v_draft\.status = 'ENVIADA'/)
  assert.match(sql, /inscricaoAprovacaoAutomatica/)
  assert.match(sql, /then 'APROVADA' else 'SOLICITADA'/)
  assert.match(sql, /enable row level security/g)
  assert.match(sql, /revoke all on public\."InscricaoEquipeRascunho" from anon, authenticated/)
  assert.doesNotMatch(sql, /create policy[\s\S]*using \(true\)/i)
}

function testPersistenceApiContract() {
  const domain = fs.readFileSync(path.join(process.cwd(), 'src/lib/team-registration-draft.ts'), 'utf8')
  const form = fs.readFileSync(path.join(process.cwd(), 'src/components/inscricao-rapida/FormularioInscricaoRapida.tsx'), 'utf8')
  const playerCollectionRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/inscricao-rapida/[token]/jogadores/route.ts'), 'utf8')
  const playerRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/inscricao-rapida/[token]/jogadores/[jogadorId]/route.ts'), 'utf8')

  assert.match(domain, /from\('InscricaoEquipeJogadorRascunho'\)\s*\.select\([^)]*\)\s*\.eq\('inscricaoRascunhoId', draft\.id\)\s*\.order\('criadoEm'\)/)
  assert.match(domain, /from\(target\)\.insert\(/)
  assert.match(domain, /\.delete\(\)\.eq\('id', playerId\)/)
  assert.doesNotMatch(domain, /\.delete\(\)\.eq\('inscricaoRascunhoId'/)
  assert.match(playerCollectionRoute, /export async function POST/)
  assert.match(playerRoute, /export async function PATCH/)
  assert.match(playerRoute, /export async function DELETE/)
  assert.match(form, /\/jogadores\/\$\{editingId\}/)
  assert.match(form, /\/jogadores\/\$\{player\.id\}/)

  assert.match(domain, /query\.eq\('inscricaoRascunhoId', context\.draft\.id\)/)
  assert.match(domain, /query\.eq\('equipeId', context\.draft\.equipeId as number\)/)
}

function testFotoAtletaOpcional() {
  const exigida = resolveFormularioRapidaConfig({ atleta: { foto: 'required', dataNascimento: 'required', documento: 'required' } })
  assert.equal(exigida.atleta.foto, 'optional', 'foto required no JSON continua opcional na inscrição')
  assert.equal(exigida.atleta.dataNascimento, 'required', 'nascimento obrigatório continua obrigatório')
  assert.equal(exigida.atleta.documento, 'required', 'documento obrigatório continua obrigatório')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { foto: 'disabled' } }).atleta.foto, 'disabled')
  assert.equal(resolveFormularioRapidaConfig(null).atleta.foto, 'optional')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { foto: 'optional' } }).atleta.foto, 'optional')

  for (const fotoUrl of [undefined, null, '', 'https://cdn.example/atleta.webp']) {
    const parsed = criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana', fotoUrl })
    assert.equal(parsed.success, true, `fotoUrl ${String(fotoUrl)} deve passar`)
  }
  assert.equal(criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana' }).success, true)
  assert.equal(criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana', fotoUrl: 'nao-e-url' }).success, false)
  assert.equal(jogadorSchema.safeParse({ nome: 'Ana', equipeId: 1 }).success, true)
  assert.equal(jogadorSchema.safeParse({ nome: 'Ana', equipeId: 1, fotoUrl: null }).success, true)
  assert.equal(jogadorSchema.safeParse({ nome: 'Ana', equipeId: 1, fotoUrl: 'https://cdn.example/a.jpg' }).success, true)

  const atleta = {
    nome: 'Ana',
    dataNascimento: '1990-01-02',
    email: 'ana@example.com',
    celular: '11999999999',
    telefoneEmergencia: '11988888888',
    documentoNumero: '123',
  }
  assert.equal(playerInscricaoSchema.safeParse(atleta).success, true)
  assert.equal(playerInscricaoSchema.safeParse({ ...atleta, fotoRostoUrl: null }).success, true)
  assert.equal(playerInscricaoSchema.safeParse({ ...atleta, fotoRostoUrl: 'https://cdn.example/rosto.jpg' }).success, true)

  const domain = fs.readFileSync(path.join(process.cwd(), 'src/lib/team-registration-draft.ts'), 'utf8')
  const form = fs.readFileSync(path.join(process.cwd(), 'src/components/inscricao-rapida/FormularioInscricaoRapida.tsx'), 'utf8')
  const capitao = fs.readFileSync(path.join(process.cwd(), 'src/app/capitao/page.tsx'), 'utf8')
  const capitaoApi = fs.readFileSync(path.join(process.cwd(), 'src/app/api/capitao/jogadores/route.ts'), 'utf8')
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010130000_foto_atleta_opcional.sql'), 'utf8')

  assert.match(domain, /fotoUrl: input\.fotoUrl \|\| null/)
  assert.doesNotMatch(domain, /Foto do jogador é obrigatória/)
  assert.doesNotMatch(domain, /foto é obrigatória/)
  assert.match(form, /Foto \(opcional\)/)
  assert.match(form, /handleJogadorFotoUpload/)
  assert.doesNotMatch(form, /fotoRequired/)
  assert.match(capitao, /Foto do atleta \(opcional\)/)
  // A foto continua opcional (vazia vira null); a validação de origem é feita por normalizarFotoRostoEntrada.
  assert.match(capitaoApi, /fotoRostoUrl: z\.string\(\)\.trim\(\)\.max\(500\)\.optional\(\)\.nullable\(\)/)
  assert.match(capitaoApi, /fotoEnviada \? normalizarFotoRostoEntrada\(/)
  assert.match(capitaoApi, /fotoUrl: fotoRostoUrl/)
  assert.match(sql, /create or replace function public\.finalizar_inscricao_equipe_rascunho/)
  assert.match(sql, /create or replace function public\.validar_jogador_formulario_categoria/)
  assert.doesNotMatch(sql, /Foto do jogador e obrigatoria/)
  assert.doesNotMatch(sql, /field_name='foto'/)
  assert.match(sql, /v_jogador\."fotoUrl"/)
  assert.match(sql, /grant execute on function public\.finalizar_inscricao_equipe_rascunho\(uuid, text\) to service_role/)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+anon\b/i)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+authenticated\b/i)
}

function testNascimentoDocumentoOpcionais() {
  const padrao = getDefaultFormularioInscricaoConfig()
  assert.equal(padrao.atleta.dataNascimento, 'optional', 'default da liga nasce opcional')
  assert.equal(padrao.atleta.documento, 'optional', 'default do documento nasce opcional')
  assert.equal(resolveFormularioRapidaConfig(null).atleta.dataNascimento, 'optional')
  assert.equal(resolveFormularioRapidaConfig(null).atleta.documento, 'optional')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { dataNascimento: 'disabled', documento: 'disabled' } }).atleta.dataNascimento, 'disabled')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { dataNascimento: 'disabled', documento: 'disabled' } }).atleta.documento, 'disabled')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { dataNascimento: 'required', documento: 'optional' } }).atleta.dataNascimento, 'required')
  assert.equal(resolveFormularioRapidaConfig({ atleta: { dataNascimento: 'required', documento: 'optional' } }).atleta.documento, 'optional')
  const daCategoria = formularioDaInscricao(
    { atleta: { dataNascimento: 'optional', documento: 'required', foto: 'required' } },
    { atleta: { dataNascimento: 'disabled', documento: 'disabled' } },
  )
  const efetiva = resolveFormularioRapidaConfig(daCategoria)
  assert.equal(efetiva.atleta.dataNascimento, 'disabled', 'não coletar da categoria esconde o nascimento')
  assert.equal(efetiva.atleta.documento, 'disabled', 'não coletar da categoria esconde o documento')
  assert.equal(efetiva.atleta.foto, 'optional')
  const obrigatorio = resolveFormularioRapidaConfig({ atleta: { dataNascimento: 'required', documento: 'required' } })
  assert.deepEqual(pendenciasDoAtleta({ dataNascimento: '', documentoNumero: ' ' }, obrigatorio), [
    'Data de nascimento é obrigatória.',
    'Documento é obrigatório.',
  ])
  assert.deepEqual(pendenciasDoAtleta({ dataNascimento: '1990-01-02', documentoNumero: '123' }, obrigatorio), [])
  assert.deepEqual(pendenciasDoAtleta({}, efetiva), [])

  for (const dataNascimento of [undefined, null, '', '1990-01-02']) {
    const parsed = criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana', dataNascimento, documentoTipo: null, documentoNumero: '' })
    assert.equal(parsed.success, true, `nascimento ${String(dataNascimento)} deve passar`)
  }
  assert.equal(criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana', dataNascimento: '02/01/1990' }).success, false)
  assert.equal(criarJogadorInscricaoRascunhoSchema.safeParse({ nome: 'Ana' }).success, true)

  const base = {
    nome: 'Ana',
    email: 'ana@example.com',
    celular: '11999999999',
    telefoneEmergencia: '11988888888',
  }
  assert.equal(playerInscricaoSchema.safeParse(base).success, true)
  assert.equal(playerInscricaoSchema.safeParse({ ...base, dataNascimento: null, documentoNumero: null, documentoTipo: '' }).success, true)
  assert.equal(playerInscricaoSchema.safeParse({ ...base, dataNascimento: '1990-01-02', documentoTipo: 'RG', documentoNumero: '123' }).success, true)
  assert.equal(playerInscricaoSchema.safeParse({ ...base, dataNascimento: 'nao-e-data' }).success, false)

  const domain = fs.readFileSync(path.join(process.cwd(), 'src/lib/team-registration-draft.ts'), 'utf8')
  const form = fs.readFileSync(path.join(process.cwd(), 'src/components/inscricao-rapida/FormularioInscricaoRapida.tsx'), 'utf8')
  const capitao = fs.readFileSync(path.join(process.cwd(), 'src/app/capitao/page.tsx'), 'utf8')
  const capitaoApi = fs.readFileSync(path.join(process.cwd(), 'src/app/api/capitao/jogadores/route.ts'), 'utf8')
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010135000_nascimento_documento_atleta_opcional.sql'), 'utf8')

  assert.match(domain, /dataNascimento: input\.dataNascimento \|\| null/)
  assert.match(domain, /documentoNumero: input\.documentoNumero \|\| null/)
  assert.match(domain, /lerFormularioDaCategoria/)
  assert.match(domain, /formularioDaInscricao/)
  assert.match(domain, /pendenciasDoAtleta/)
  const regras = fs.readFileSync(path.join(process.cwd(), 'src/lib/inscricao-rapida.ts'), 'utf8')
  assert.match(regras, /Data de nascimento é obrigatória/)
  assert.match(regras, /Documento é obrigatório/)
  assert.match(form, /Data de nascimento \(opcional\)/)
  assert.match(form, /Número do documento \(opcional\)/)
  assert.match(form, /nascimentoRequired/)
  assert.match(form, /documentoRequired/)
  assert.match(capitao, /Nascimento \(opcional\)/)
  assert.match(capitao, /Documento \(opcional\)/)
  assert.match(capitaoApi, /dataNascimento: z\.string\(\)\.regex\(/)
  assert.match(capitaoApi, /documentoNumero: z\.string\(\)\.max\(80\)\.optional\(\)\.nullable\(\)/)
  assert.match(capitaoApi, /dataNascimento: data\.dataNascimento \? new Date/)
  assert.match(sql, /create or replace function public\.finalizar_inscricao_equipe_rascunho/)
  assert.match(sql, /create or replace function public\.validar_jogador_formulario_categoria/)
  assert.doesNotMatch(sql, /Data de nascimento e obrigatoria/)
  assert.doesNotMatch(sql, /Documento do jogador e obrigatorio/)
  assert.doesNotMatch(sql, /'dataNascimento', 'dataNascimento', 'required'/)
  assert.doesNotMatch(sql, /'documento', 'documentoNumero', 'required'/)
  assert.match(sql, /v_jogador\."dataNascimento"/)
  assert.match(sql, /v_jogador\."documentoNumero"/)
  assert.match(sql, /grant execute on function public\.finalizar_inscricao_equipe_rascunho\(uuid, text\) to service_role/)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+anon\b/i)
  assert.doesNotMatch(sql, /\bgrant\b[^;]*\bto\s+authenticated\b/i)
}

testRegistrationWindow()
testEditRules()
testMigrationContract()
testPersistenceApiContract()
testFotoAtletaOpcional()
testNascimentoDocumentoOpcionais()

console.log('team-registration-draft tests: ok')
