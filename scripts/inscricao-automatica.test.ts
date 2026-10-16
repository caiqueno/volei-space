import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { criarBanco, instalarSupabaseFalso } from './helpers/fake-supabase'
import { STATUS_INSCRICAO_AUTOMATICA, statusInicialDaInscricao } from '../src/lib/inscricao-status'

process.env.JWT_SECRET = 'segredo-de-teste-inscricao-automatica-32-chars'

function ler(relativo: string) {
  return fs.readFileSync(path.join(process.cwd(), relativo), 'utf8')
}

// A inscrição é automática: o status inicial é sempre APROVADA, qualquer que seja a flag antiga.
assert.equal(STATUS_INSCRICAO_AUTOMATICA, 'APROVADA')
for (const flag of [true, false, null, undefined]) assert.equal(statusInicialDaInscricao(flag), 'APROVADA')

// Nenhuma rota do fluxo novo grava SOLICITADA nem decide aprovar/rejeitar.
const rotas = [
  'src/app/api/inscricoes-campeonato/route.ts',
  'src/app/api/candidaturas/equipes/route.ts',
]
for (const rota of rotas) {
  const texto = ler(rota)
  assert.doesNotMatch(texto, /status:\s*'SOLICITADA'|\?\s*'APROVADA'\s*:\s*'SOLICITADA'|:\s*'SOLICITADA'/, `${rota} grava SOLICITADA`)
}
assert.doesNotMatch(ler('src/lib/team-activation.ts'), /:\s*'SOLICITADA'/)

// Cadastro de equipe em campeonato por ID, sem convite, não é aceito (a entrada é o link do organizador).
assert.match(ler('src/app/api/candidaturas/equipes/route.ts'), /!invitation && requestedLigaId/)

// --- PATCH de aprovação/rejeição está desligado -------------------------------
const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

function req(metodo: string, corpo: unknown) {
  return new NextRequest('http://127.0.0.1:3001/api/inscricoes-campeonato', {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.3.3.3' },
    body: JSON.stringify(corpo),
  })
}

async function main() {
  banco.atual = criarBanco({ InscricaoCampeonato: [{ id: 'insc-1', ligaId: 1, equipeId: 5, status: 'APROVADA' }], Liga: [] })
  const { signPublicToken } = await import('../src/lib/auth')
  const { PATCH } = await import('../src/app/api/inscricoes-campeonato/route')

  sessao.token = await signPublicToken({
    userId: 'org-1', email: 'org@volei.space', nome: 'Org', tipo: 'organizador', status: 'ATIVA', trocarSenha: false,
  })
  for (const status of ['APROVADA', 'REJEITADA', 'SOLICITADA']) {
    const resposta = await PATCH(req('PATCH', { id: 'insc-1', status }))
    assert.equal(resposta.status, 410, `PATCH ${status} deve estar desligado`)
  }
  // O estado da inscrição não foi alterado.
  const linha = (banco.atual as ReturnType<typeof criarBanco>).from('InscricaoCampeonato')
  const { data } = await linha.select('id,status').eq('id', 'insc-1').maybeSingle()
  assert.equal((data as { status: string }).status, 'APROVADA')

  // Continuam valendo a autenticação e a validação do corpo (antes do 410).
  sessao.token = null
  assert.equal((await PATCH(req('PATCH', { id: 'insc-1', status: 'APROVADA' }))).status, 401)
  sessao.token = await signPublicToken({
    userId: 'org-1', email: 'org@volei.space', nome: 'Org', tipo: 'organizador', status: 'PENDENTE', trocarSenha: false,
  })
  assert.equal((await PATCH(req('PATCH', { id: 'insc-1', status: 'APROVADA' }))).status, 403)
  assert.equal((await PATCH(req('PATCH', { id: '', status: 'APROVADA' }))).status, 422)

  console.log('inscricao-automatica: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
