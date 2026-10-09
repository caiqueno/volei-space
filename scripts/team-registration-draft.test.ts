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

testRegistrationWindow()
testEditRules()
testMigrationContract()
testPersistenceApiContract()

console.log('team-registration-draft tests: ok')
