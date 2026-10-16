import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import {
  MemoryRateLimitStore,
  RateLimitStoreComFallback,
  SupabaseRateLimitStore,
  definirStoreDeRateLimit,
  type RateLimitStore,
} from '../src/lib/rate-limit'
import { getSecret, assinarToken, lerToken } from '../src/lib/token-verify'

process.env.JWT_SECRET = 'segredo-de-teste-rate-limit-com-32-caracteres'
delete process.env.ADMIN_EMAIL

// --- Fakes ---------------------------------------------------------------

type Linha = Record<string, unknown>

function criarBanco(tabelas: Record<string, Linha[]>) {
  const from = (nome: string) => {
    const filtros: Array<(l: Linha) => boolean> = []
    let operacao: 'select' | 'update' | 'delete' | 'upsert' = 'select'
    let valores: Linha = {}
    let retornaLinhas = false
    const executar = () => {
      const tabela = tabelas[nome]
      if (!tabela) return { data: null, error: { code: '42P01', message: `relation "${nome}" does not exist` } }
      const alvo = tabela.filter((l) => filtros.every((f) => f(l)))
      if (operacao === 'select') return { data: alvo, error: null }
      if (operacao === 'delete') {
        tabelas[nome] = tabela.filter((l) => !alvo.includes(l))
        return { data: null, error: null }
      }
      if (operacao === 'update') {
        alvo.forEach((l) => Object.assign(l, valores))
        return { data: retornaLinhas ? alvo : null, error: null }
      }
      const existente = tabela.find((l) => l.chave === valores.chave)
      if (existente) Object.assign(existente, valores)
      else tabela.push({ ...valores })
      return { data: null, error: null }
    }
    const b: any = {
      select() {
        if (operacao === 'update') retornaLinhas = true
        return b
      },
      ilike(coluna: string, valor: string) {
        filtros.push((l) => String(l[coluna] ?? '').toLowerCase() === valor.toLowerCase())
        return b
      },
      eq(coluna: string, valor: unknown) {
        filtros.push((l) => l[coluna] === valor)
        return b
      },
      is() { return b },
      limit() { return b },
      order() { return b },
      update(v: Linha) { operacao = 'update'; valores = v; return b },
      delete() { operacao = 'delete'; return b },
      upsert(v: Linha) { operacao = 'upsert'; valores = v; return b },
      maybeSingle() {
        const r = executar()
        return Promise.resolve(r.error ? r : { data: (r.data as Linha[])[0] ?? null, error: null })
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(executar()).then(res, rej)
      },
    }
    return b
  }
  return { from }
}

const banco = { atual: criarBanco({}) }
const supabaseFalso = { from: (nome: string) => banco.atual.from(nome) }
const caminhoSupabase = require.resolve('../src/lib/supabase-admin')
require.cache[caminhoSupabase] = {
  id: caminhoSupabase,
  filename: caminhoSupabase,
  loaded: true,
  exports: { supabaseAdmin: supabaseFalso, isSupabaseServiceConfigured: true },
} as unknown as NodeJS.Module

function requisicao(url: string, corpo: unknown, ip = '10.0.0.1') {
  return new NextRequest(`http://127.0.0.1:3001${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(corpo),
  })
}

// --- Testes de store -----------------------------------------------------

async function testeMemoria() {
  const s = new MemoryRateLimitStore()
  const t0 = 1_000_000
  for (let i = 0; i < 3; i += 1) assert.equal((await s.consumir('a', 3, 60_000, t0)).permitido, true)
  const bloqueado = await s.consumir('a', 3, 60_000, t0 + 1000)
  assert.equal(bloqueado.permitido, false)
  assert.equal(bloqueado.retryAfterSeconds, 59)
  assert.equal((await s.consumir('b', 3, 60_000, t0)).permitido, true, 'chaves independentes')
  assert.equal((await s.consultar('a', t0 + 1000)).contagem, 3)
  assert.equal((await s.consumir('a', 3, 60_000, t0 + 60_001)).permitido, true, 'janela expira')
  await s.zerar('a')
  assert.equal((await s.consultar('a', t0)).contagem, 0)
}

async function testeSupabaseStore() {
  const tabelas = { RateLimit: [] as Linha[] }
  const s = new SupabaseRateLimitStore(criarBanco(tabelas))
  const t0 = Date.now()
  for (let i = 0; i < 3; i += 1) assert.equal((await s.consumir('k', 3, 60_000, t0)).permitido, true)
  assert.equal((await s.consumir('k', 3, 60_000, t0)).permitido, false)
  assert.equal(tabelas.RateLimit.length, 1)
  assert.equal(tabelas.RateLimit[0].contagem, 3)
  assert.equal((await s.consultar('k', t0)).contagem, 3)
  assert.equal((await s.consumir('k', 3, 60_000, t0 + 61_000)).permitido, true, 'expirada recomeça')
  await s.zerar('k')
  assert.equal(tabelas.RateLimit.length, 0)
}

async function testeFallbackSemTabela() {
  const avisos: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => { avisos.push(args) }
  try {
    const semTabela = new SupabaseRateLimitStore(criarBanco({}))
    let agora = 5_000
    const s = new RateLimitStoreComFallback(semTabela, new MemoryRateLimitStore(), () => agora)
    for (let i = 0; i < 2; i += 1) assert.equal((await s.consumir('x', 2, 60_000, 1)).permitido, true)
    assert.equal((await s.consumir('x', 2, 60_000, 1)).permitido, false, 'memória aplica o limite')
    assert.equal(avisos.length, 1, 'avisa uma vez e não insiste na tabela ausente')
    agora += 10 * 60 * 1000
    await s.consultar('x', 1)
    assert.equal(avisos.length, 2, 'volta a tentar depois do intervalo')
  } finally {
    console.warn = original
  }
}

// --- Segredos por finalidade --------------------------------------------

async function testeSegredos() {
  const a = Buffer.from(getSecret('session')).toString('hex')
  const b = Buffer.from(getSecret('password-reset')).toString('hex')
  const c = Buffer.from(getSecret('account-activation')).toString('hex')
  assert.equal(new Set([a, b, c]).size, 3)
  assert.notEqual(a, Buffer.from(process.env.JWT_SECRET!).toString('hex'))

  const sessao = await assinarToken({ x: 1 }, 'public', '1h')
  assert.ok(await lerToken(sessao, 'public'))
  assert.equal(await lerToken(sessao, 'reset'), null)
  assert.equal(await lerToken(sessao, 'activation'), null)

  const ativacao = await assinarToken({ purpose: 'account-activation' }, 'activation', '1h')
  assert.ok(await lerToken(ativacao, 'activation'))
  assert.equal(await lerToken(ativacao, 'public'), null)

  const avisos: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => { avisos.push(args) }
  try {
    process.env.JWT_SECRET = 'curto'
    getSecret('session')
    getSecret('session')
    assert.equal(avisos.length, 1, 'aviso de segredo fraco uma vez')
    delete process.env.JWT_SECRET
    assert.throws(() => getSecret('session'), /JWT_SECRET not set/)
  } finally {
    console.warn = original
    process.env.JWT_SECRET = 'segredo-de-teste-rate-limit-com-32-caracteres'
  }
}

// --- Rotas ---------------------------------------------------------------

async function testeLogin() {
  const loja: RateLimitStore = new MemoryRateLimitStore()
  definirStoreDeRateLimit(loja)
  const senhaHash = await bcrypt.hash('senha-correta-1', 4)
  banco.atual = criarBanco({
    Admin: [],
    CandidaturaOrganizador: [{ id: 'org-1', email: 'org@volei.space', nome: 'Org', status: 'ATIVA', senhaHash, trocarSenha: false }],
    CandidaturaEquipe: [], CandidaturaArbitro: [], CandidaturaQuadra: [], ContaPublico: [],
  })
  const { POST } = await import('../src/app/api/auth/route')
  const tentar = (email: string, senha: string, ip = '10.0.0.1') =>
    POST(requisicao('/api/auth', { email, senha, perfil: 'organizador' }, ip))

  // Falhas contam; sucesso zera.
  for (let i = 0; i < 4; i += 1) assert.equal((await tentar('org@volei.space', 'errada')).status, 401)
  assert.equal((await tentar('org@volei.space', 'senha-correta-1')).status, 200)
  for (let i = 0; i < 5; i += 1) assert.equal((await tentar('org@volei.space', 'errada')).status, 401, `falha ${i + 1}`)

  // A 6a tentativa vira 429, mesmo com a senha certa.
  const sexta = await tentar('org@volei.space', 'errada')
  assert.equal(sexta.status, 429)
  assert.ok(Number(sexta.headers.get('retry-after')) > 0)
  assert.equal((await tentar('org@volei.space', 'senha-correta-1')).status, 429, 'senha certa durante o bloqueio')

  // Outro e-mail, mesmo IP, segue liberado (limite por IP é maior).
  assert.equal((await tentar('outro@volei.space', 'errada')).status, 401)

  // Usuário inexistente também conta falha (sem revelar existência).
  for (let i = 0; i < 5; i += 1) await tentar('fantasma@volei.space', 'x')
  assert.equal((await tentar('fantasma@volei.space', 'x')).status, 429)
}

async function testeForgot() {
  definirStoreDeRateLimit(new MemoryRateLimitStore())
  banco.atual = criarBanco({ Admin: [] })
  const { POST } = await import('../src/app/api/auth/forgot-password/route')
  const corpos: string[] = []
  for (let i = 0; i < 5; i += 1) {
    const res = await POST(requisicao('/api/auth/forgot-password', { email: 'alguem@volei.space' }, '10.9.9.9'))
    assert.equal(res.status, 200, `tentativa ${i + 1}`)
    corpos.push(JSON.stringify(await res.json()))
  }
  assert.equal(new Set(corpos).size, 1, 'resposta sempre igual, com ou sem bloqueio')

  // Limite por IP: 3 e-mails diferentes passam, o 4o ainda responde igual.
  definirStoreDeRateLimit(new MemoryRateLimitStore())
  let enviados = 0
  const consultasAdmin = { n: 0 }
  banco.atual = { from: (nome: string) => { if (nome === 'Admin') consultasAdmin.n += 1; return criarBanco({ Admin: [] }).from(nome) } }
  for (let i = 0; i < 6; i += 1) {
    const res = await POST(requisicao('/api/auth/forgot-password', { email: `p${i}@volei.space` }, '10.8.8.8'))
    assert.equal(res.status, 200)
    enviados += 1
  }
  assert.equal(enviados, 6)
  assert.equal(consultasAdmin.n, 3, 'acima de 3/h por IP nem consulta o banco')
}

async function testeResetEAtivar() {
  definirStoreDeRateLimit(new MemoryRateLimitStore())
  banco.atual = criarBanco({ Admin: [], CandidaturaOrganizador: [] })
  const reset = await import('../src/app/api/auth/reset-password/route')
  let ultimo = 0
  for (let i = 0; i < 11; i += 1) {
    const res = await reset.POST(requisicao('/api/auth/reset-password', { token: 'x'.repeat(30), senha: '12345678' }, '10.7.7.7'))
    ultimo = res.status
  }
  assert.equal(ultimo, 429)

  const ativar = await import('../src/app/api/auth/ativar-conta/route')
  for (let i = 0; i < 21; i += 1) {
    const res = await ativar.POST(requisicao('/api/auth/ativar-conta', { token: 'x'.repeat(30) }, '10.6.6.6'))
    ultimo = res.status
  }
  assert.equal(ultimo, 429)
}

async function main() {
  await testeMemoria()
  await testeSupabaseStore()
  await testeFallbackSemTabela()
  await testeSegredos()
  await testeLogin()
  await testeForgot()
  await testeResetEAtivar()
  console.log('rate-limit: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
