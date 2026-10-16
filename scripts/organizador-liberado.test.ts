import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { criarBanco, instalarSupabaseFalso } from './helpers/fake-supabase'

process.env.JWT_SECRET = 'segredo-de-teste-organizador-liberado-32-chars'

// --- Fakes: sessão (next/headers) e banco --------------------------------
const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

function req(metodo: string, url: string, corpo: unknown, ip = '10.1.1.1') {
  return new NextRequest(`http://127.0.0.1:3001${url}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(corpo),
  })
}

async function entrarComo(status: string, trocarSenha = false) {
  const { signPublicToken } = await import('../src/lib/auth')
  sessao.token = await signPublicToken({
    userId: 'org-1', email: 'org@volei.space', nome: 'Org', tipo: 'organizador', status, trocarSenha,
  })
}

async function testeEscritasExigemLiberado() {
  banco.atual = criarBanco({ CandidaturaOrganizador: [{ id: 'org-1' }], InscricaoCampeonato: [], Liga: [] })
  const ligas = await import('../src/app/api/ligas/route')
  const perfil = await import('../src/app/api/organizador/perfil/route')
  const inscricoes = await import('../src/app/api/inscricoes-campeonato/route')

  const escritas = () => [
    ['POST /api/ligas', ligas.POST(req('POST', '/api/ligas', { nome: 'Copa', slug: 'copa', organizadorId: 'org-1' }))],
    ['PATCH /api/organizador/perfil', perfil.PATCH(req('PATCH', '/api/organizador/perfil', { organizacao: 'Org' }))],
    ['PATCH /api/inscricoes-campeonato', inscricoes.PATCH(req('PATCH', '/api/inscricoes-campeonato', { id: 'x', status: 'APROVADA' }))],
  ] as const

  for (const status of ['PENDENTE', 'REJEITADO', 'REJEITADA']) {
    await entrarComo(status)
    for (const [nome, promessa] of escritas()) {
      assert.equal((await promessa).status, 403, `${nome} com ${status}`)
    }
  }

  // Liberado, mas obrigado a trocar a senha: continua barrado.
  await entrarComo('ATIVA', true)
  for (const [nome, promessa] of escritas()) {
    assert.equal((await promessa).status, 403, `${nome} com troca de senha pendente`)
  }

  // Sem sessão: 401.
  sessao.token = null
  for (const [nome, promessa] of escritas()) {
    assert.equal((await promessa).status, 401, `${nome} sem sessão`)
  }

  // Liberado passa pela porta de autorização (erros do banco falso são esperados).
  const erroOriginal = console.error
  console.error = () => {}
  try {
    await testeLiberadosPassam(escritas, perfil)
  } finally {
    console.error = erroOriginal
  }
}

async function testeLiberadosPassam(
  escritas: () => ReadonlyArray<readonly [string, Promise<Response>]>,
  perfil: typeof import('../src/app/api/organizador/perfil/route'),
) {
  for (const status of ['ATIVA', 'APROVADO', 'LIBERADO']) {
    await entrarComo(status)
    const resposta = await perfil.PATCH(req('PATCH', '/api/organizador/perfil', { organizacao: 'Org' }))
    assert.equal(resposta.status, 200, `perfil com ${status}`)
    for (const [nome, promessa] of escritas()) {
      const { status: codigo } = await promessa
      assert.ok(codigo !== 401 && codigo !== 403, `${nome} com ${status} devolveu ${codigo}`)
    }
  }
}

async function testeLeituraDoPerfilContinuaAberta() {
  banco.atual = criarBanco({ CandidaturaOrganizador: [{ id: 'org-1', nome: 'Org' }] })
  const perfil = await import('../src/app/api/organizador/perfil/route')
  await entrarComo('PENDENTE')
  const resposta = await perfil.GET(req('GET', '/api/organizador/perfil', undefined))
  assert.notEqual(resposta.status, 403)
  assert.notEqual(resposta.status, 401)
}

async function ativar(token: string, ip: string) {
  const rota = await import('../src/app/api/auth/ativar-conta/route')
  return rota.POST(req('POST', '/api/auth/ativar-conta', { token }, ip))
}

async function testeAtivacao() {
  const { definirStoreDeRateLimit, MemoryRateLimitStore } = await import('../src/lib/rate-limit')
  const { signAccountActivationToken } = await import('../src/lib/auth')
  const { lerToken } = await import('../src/lib/token-verify')
  const { COOKIE_SESSAO } = await import('../src/lib/cookie-gestao')
  definirStoreDeRateLimit(new MemoryRateLimitStore())

  const candidaturas = [{
    id: 'org-1', nome: 'Org', email: 'org@volei.space', status: 'ATIVA', trocarSenha: true, emailVerificadoEm: null,
  }]
  banco.atual = criarBanco({ CandidaturaOrganizador: candidaturas })
  const link = await signAccountActivationToken({ candidaturaId: 'org-1', email: 'org@volei.space' })

  const primeira = await ativar(link, '10.2.2.1')
  assert.equal(primeira.status, 200)
  const cookie = primeira.cookies.get(COOKIE_SESSAO)
  assert.ok(cookie?.value)
  const jwt = await lerToken<{ status: string; trocarSenha: boolean; tipo: string }>(cookie!.value, 'public')
  assert.equal(jwt?.tipo, 'organizador')
  assert.equal(jwt?.status, 'ATIVA')
  assert.equal(jwt?.trocarSenha, true, 'JWT copia trocarSenha do banco')
  assert.ok(candidaturas[0].emailVerificadoEm, 'link consumido')

  const segunda = await ativar(link, '10.2.2.1')
  assert.equal(segunda.status, 400, 'token já consumido')
  assert.equal(segunda.cookies.get(COOKIE_SESSAO), undefined)

  // Status PENDENTE vai para o JWT como está, e a coluna trocarSenha pode não existir.
  const pendentes = [{
    id: 'org-2', nome: 'Org2', email: 'dois@volei.space', status: 'PENDENTE', emailVerificadoEm: null,
  }]
  banco.atual = criarBanco({ CandidaturaOrganizador: pendentes }, { colunasAusentes: { CandidaturaOrganizador: ['trocarSenha'] } })
  const link2 = await signAccountActivationToken({ candidaturaId: 'org-2', email: 'dois@volei.space' })
  const resposta2 = await ativar(link2, '10.2.2.2')
  assert.equal(resposta2.status, 200)
  const jwt2 = await lerToken<{ status: string; trocarSenha: boolean }>(resposta2.cookies.get(COOKIE_SESSAO)!.value, 'public')
  assert.equal(jwt2?.status, 'PENDENTE')
  assert.equal(jwt2?.trocarSenha, false)

  // E-mail diferente do token: não ativa.
  banco.atual = criarBanco({ CandidaturaOrganizador: [{ id: 'org-3', nome: 'T', email: 'outro@volei.space', status: 'ATIVA', emailVerificadoEm: null }] })
  const link3 = await signAccountActivationToken({ candidaturaId: 'org-3', email: 'org@volei.space' })
  assert.equal((await ativar(link3, '10.2.2.3')).status, 400)
}

async function main() {
  await testeEscritasExigemLiberado()
  await testeLeituraDoPerfilContinuaAberta()
  await testeAtivacao()
  console.log('organizador-liberado: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
