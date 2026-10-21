process.env.LGPD_CHAVE_CIFRA = Buffer.alloc(32, 7).toString('base64')
import assert from 'node:assert/strict'

process.env.JWT_SECRET = 'segredo-de-teste-volei-space-com-mais-de-32-chars'

import { MemoryRateLimitStore, definirStoreDeRateLimit } from '../src/lib/rate-limit'
import { enviarCodigo, enviarPorWhatsapp, mascararDestino } from '../src/lib/mensageria'
import {
  CODIGO_MAX_TENTATIVAS,
  CODIGO_VALIDADE_MS,
  RecursoNaoHabilitadoError,
  conferirCodigo,
  gerarCodigo,
  hashDoCodigo,
  loginSemSenhaAtivo,
} from '../src/lib/login-sem-senha/config'
import { confirmarCodigo, solicitarCodigo, type DepsCodigo } from '../src/lib/login-sem-senha/servico'
import { trocarPerfil } from '../src/lib/login-sem-senha/troca'
import { trocarCodigoGoogle, usuarioGoogleDaResposta, vincularIdentidade } from '../src/lib/login-sem-senha/google'

type Linha = Record<string, any>

function criarBanco(tabelas: Record<string, Linha[]>) {
  const from = (nome: string) => {
    const filtros: Array<(l: Linha) => boolean> = []
    let op: 'select' | 'update' | 'insert' = 'select'
    let valores: Linha = {}
    let retorna = false
    let ordem: { col: string; asc: boolean } | null = null
    let max = Infinity
    const executar = () => {
      const tabela = tabelas[nome]
      if (!tabela) return { data: null, error: { code: '42P01', message: `relation "${nome}" does not exist` } }
      if (op === 'insert') {
        tabela.push({ id: `id-${tabela.length + 1}`, ...valores })
        return { data: null, error: null }
      }
      let alvo = tabela.filter((l) => filtros.every((f) => f(l)))
      if (op === 'update') {
        alvo.forEach((l) => Object.assign(l, valores))
        return { data: retorna ? alvo.map((l) => ({ ...l })) : null, error: null }
      }
      if (ordem) {
        const { col, asc } = ordem
        alvo = [...alvo].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
      }
      return { data: alvo.slice(0, max).map((l) => ({ ...l })), error: null }
    }
    const b: any = {
      select() { if (op === 'update') retorna = true; return b },
      insert(v: Linha) { op = 'insert'; valores = v; return b },
      update(v: Linha) { op = 'update'; valores = v; return b },
      eq(c: string, v: unknown) { filtros.push((l) => l[c] === v); return b },
      is(c: string, v: unknown) { filtros.push((l) => (l[c] ?? null) === v); return b },
      ilike(c: string, v: string) {
        const alvo = v.replace(/\\/g, '').toLowerCase()
        filtros.push((l) => String(l[c] ?? '').toLowerCase() === alvo)
        return b
      },
      order(col: string, o: { ascending: boolean }) { ordem = { col, asc: o.ascending }; return b },
      limit(n: number) { max = n; return b },
      then(ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) {
        return Promise.resolve(executar()).then(ok, ko)
      },
    }
    return b
  }
  return { from }
}

function ambiente(extra: Partial<Record<string, Linha[]>> = {}) {
  const tabelas: Record<string, Linha[]> = {
    CodigoAcesso: [],
    CandidaturaEquipe: [{ id: 'eq-1', email: 'lider@teste.com', nome: 'Equipe Alfa', status: 'APROVADA', telefone: '(11) 91234-5678' }],
    CandidaturaOrganizador: [
      { id: 'org-1', email: 'lider@teste.com', nome: 'Liga Beta', status: 'APROVADO', telefone: '11912345678' },
      { id: 'org-2', email: 'pendente@teste.com', nome: 'Pendente', status: 'PENDENTE' },
    ],
    Admin: [{ id: 1, email: 'chefe@teste.com' }],
    IdentidadeExterna: [],
    ...(extra as Record<string, Linha[]>),
  }
  const enviados: Array<{ canal: string; destino: string; codigo: string }> = []
  let agora = 1_700_000_000_000
  const deps: DepsCodigo = {
    db: criarBanco(tabelas),
    enviar: async (e) => { enviados.push(e) },
    canalDisponivel: () => true,
    agora: () => agora,
    atrasoMinimoMs: 0,
  }
  return { tabelas, enviados, deps, avancar: (ms: number) => { agora += ms } }
}

function novoLimitador() {
  definirStoreDeRateLimit(new MemoryRateLimitStore())
}

async function testeFlag() {
  assert.equal(loginSemSenhaAtivo({}), false)
  assert.equal(loginSemSenhaAtivo({ LOGIN_SEM_SENHA_ATIVO: '0' }), false)
  assert.equal(loginSemSenhaAtivo({ LOGIN_SEM_SENHA_ATIVO: '1' }), true)
  delete process.env.LOGIN_SEM_SENHA_ATIVO
  const { respostaFlagDesligada, bloqueioPorFlag } = await import('../src/lib/login-sem-senha/sessao')
  assert.equal(bloqueioPorFlag()?.status, 404)
  assert.equal(respostaFlagDesligada().status, 404)
  process.env.LOGIN_SEM_SENHA_ATIVO = '1'
  assert.equal(bloqueioPorFlag(), null)
  delete process.env.LOGIN_SEM_SENHA_ATIVO
}

function testeHash() {
  const codigo = gerarCodigo()
  assert.match(codigo, /^\d{6}$/)
  const h = hashDoCodigo(codigo, 'a@b.com')
  assert.ok(!h.includes(codigo) || codigo.length < 6)
  assert.equal(h.split(':').length, 2)
  assert.notEqual(h, hashDoCodigo(codigo, 'a@b.com'), 'sal aleatório')
  assert.equal(conferirCodigo(codigo, 'a@b.com', h), true)
  assert.equal(conferirCodigo('000000' === codigo ? '111111' : '000000', 'a@b.com', h), false)
  assert.equal(conferirCodigo(codigo, 'outro@b.com', h), false)
  assert.equal(conferirCodigo(codigo, 'a@b.com', 'lixo'), false)
}

async function testeUniformeSemEnumeracao() {
  novoLimitador()
  const a = ambiente()
  const existe = await solicitarCodigo(a.deps, { email: 'Lider@Teste.com', ip: '1.1.1.1' })
  const naoExiste = await solicitarCodigo(a.deps, { email: 'ninguem@teste.com', ip: '1.1.1.2' })
  assert.deepEqual(existe, { tipo: 'aceito' })
  assert.deepEqual(naoExiste, { tipo: 'aceito' })
  assert.equal(a.enviados.length, 2, 'qualquer e-mail recebe código; conta nova entra por onboarding')
  for (const linha of a.tabelas.CodigoAcesso) {
    assert.ok(!JSON.stringify(linha).includes(a.enviados.find((e) => e.destino === linha.emailNormalizado)!.codigo), 'código em claro não é guardado')
    assert.match(String(linha.codigoHash), /^[0-9a-f]+:[0-9a-f]+$/)
    assert.equal(linha.tentativas, 0)
  }
  // Confirmar com código errado responde igual para e-mail com e sem conta.
  const r1 = await confirmarCodigo(a.deps, { email: 'lider@teste.com', codigo: '000000', ip: '2.2.2.2' })
  const r2 = await confirmarCodigo(a.deps, { email: 'sem-codigo@teste.com', codigo: '000000', ip: '2.2.2.3' })
  assert.deepEqual(r1.tipo === 'ok' ? null : r1, { tipo: 'invalido' })
  assert.deepEqual(r2, { tipo: 'invalido' })
  // Entrada malformada.
  assert.equal((await solicitarCodigo(a.deps, { email: 'x', ip: '1.1.1.1' })).tipo, 'invalido')
}

async function testeFluxoUsoUnicoEExpiracao() {
  novoLimitador()
  const a = ambiente()
  await solicitarCodigo(a.deps, { email: 'lider@teste.com', ip: '3.3.3.3' })
  const codigo = a.enviados[0].codigo
  const ok = await confirmarCodigo(a.deps, { email: 'lider@teste.com', codigo, ip: '3.3.3.3' })
  assert.equal(ok.tipo, 'ok')
  if (ok.tipo === 'ok') {
    const tipos = ok.perfis.map((p) => p.perfil).sort()
    assert.deepEqual(tipos, ['LIDER', 'ORGANIZADOR'])
  }
  const reuso = await confirmarCodigo(a.deps, { email: 'lider@teste.com', codigo, ip: '3.3.3.3' })
  assert.deepEqual(reuso, { tipo: 'invalido' }, 'uso único')

  // Expiração aos 10 minutos.
  novoLimitador()
  const b = ambiente()
  await solicitarCodigo(b.deps, { email: 'lider@teste.com', ip: '4.4.4.4' })
  b.avancar(CODIGO_VALIDADE_MS + 1000)
  assert.deepEqual(await confirmarCodigo(b.deps, { email: 'lider@teste.com', codigo: b.enviados[0].codigo, ip: '4.4.4.4' }), { tipo: 'invalido' })

  // Dentro do prazo ainda vale.
  novoLimitador()
  const c = ambiente()
  await solicitarCodigo(c.deps, { email: 'lider@teste.com', ip: '5.5.5.5' })
  c.avancar(CODIGO_VALIDADE_MS - 1000)
  assert.equal((await confirmarCodigo(c.deps, { email: 'lider@teste.com', codigo: c.enviados[0].codigo, ip: '5.5.5.5' })).tipo, 'ok')

  // Novo pedido invalida o anterior.
  novoLimitador()
  const d = ambiente()
  await solicitarCodigo(d.deps, { email: 'lider@teste.com', ip: '6.6.6.6' })
  await solicitarCodigo(d.deps, { email: 'lider@teste.com', ip: '6.6.6.6' })
  const [primeiro, segundo] = d.enviados.map((e) => e.codigo)
  if (primeiro !== segundo) {
    assert.deepEqual(await confirmarCodigo(d.deps, { email: 'lider@teste.com', codigo: primeiro, ip: '6.6.6.6' }), { tipo: 'invalido' })
  }
}

async function testeTentativas() {
  novoLimitador()
  const a = ambiente()
  await solicitarCodigo(a.deps, { email: 'lider@teste.com', ip: '7.7.7.7' })
  const certo = a.enviados[0].codigo
  const errado = certo === '123456' ? '654321' : '123456'
  for (let i = 0; i < CODIGO_MAX_TENTATIVAS; i += 1) {
    // IP diferente a cada tentativa para isolar a regra de tentativas do rate limit.
    assert.deepEqual(await confirmarCodigo(a.deps, { email: 'lider@teste.com', codigo: errado, ip: `8.8.8.${i}` }), { tipo: 'invalido' })
  }
  assert.ok(a.tabelas.CodigoAcesso[0].usadoEm, 'código invalidado após o máximo de tentativas')
  assert.deepEqual(await confirmarCodigo(a.deps, { email: 'lider@teste.com', codigo: certo, ip: '8.8.9.9' }), { tipo: 'invalido' })
}

async function testeRateLimit() {
  novoLimitador()
  const a = ambiente()
  const resultados: string[] = []
  for (let i = 0; i < 7; i += 1) {
    resultados.push((await solicitarCodigo(a.deps, { email: 'lider@teste.com', ip: '9.9.9.9' })).tipo)
  }
  assert.deepEqual(resultados.slice(0, 5), Array(5).fill('aceito'))
  assert.equal(resultados[5], 'limitado')
  assert.equal(a.enviados.length, 5, 'nada é enviado depois do limite')

  // Por destino: e-mails iguais de IPs diferentes também esbarram.
  novoLimitador()
  const b = ambiente()
  let limitado = false
  for (let i = 0; i < 8; i += 1) {
    const r = await solicitarCodigo(b.deps, { email: 'alvo@teste.com', ip: `10.0.0.${i}` })
    if (r.tipo === 'limitado') limitado = true
  }
  assert.ok(limitado, 'limite por destino')

  // Por IP.
  novoLimitador()
  const c = ambiente()
  let limitadoIp = false
  for (let i = 0; i < 25; i += 1) {
    const r = await solicitarCodigo(c.deps, { email: `u${i}@teste.com`, ip: '11.0.0.1' })
    if (r.tipo === 'limitado') limitadoIp = true
  }
  assert.ok(limitadoIp, 'limite por IP')

  // Confirmar: a reserva vem antes da conferência; depois do limite nem o código certo passa.
  novoLimitador()
  const d = ambiente()
  await solicitarCodigo(d.deps, { email: 'lider@teste.com', ip: '12.0.0.1' })
  const certo = d.enviados[0].codigo
  const errado = certo === '123456' ? '654321' : '123456'
  const rs: string[] = []
  for (let i = 0; i < 12; i += 1) rs.push((await confirmarCodigo(d.deps, { email: 'lider@teste.com', codigo: i < 11 ? errado : certo, ip: '12.0.0.1' })).tipo)
  assert.equal(rs[10], 'limitado')
  assert.equal(rs[11], 'limitado')

  // Limitador fora do ar: falha fechado.
  definirStoreDeRateLimit({
    consumir: async () => { throw new Error('indisponível') },
    consultar: async () => { throw new Error('indisponível') },
    zerar: async () => undefined,
  })
  const e = ambiente()
  assert.equal((await solicitarCodigo(e.deps, { email: 'lider@teste.com', ip: '13.0.0.1' })).tipo, 'limitado')
  assert.equal(e.enviados.length, 0)
}

async function testeWhatsapp() {
  novoLimitador()
  const a = ambiente()
  // Telefone que não é o cadastrado: resposta igual, nada enviado.
  const estranho = await solicitarCodigo(a.deps, { email: 'lider@teste.com', canal: 'WHATSAPP', telefone: '(21) 99999-0000', ip: '14.0.0.1' })
  assert.deepEqual(estranho, { tipo: 'aceito' })
  assert.equal(a.enviados.length, 0)
  assert.equal(a.tabelas.CodigoAcesso.length, 0)
  // Conta inexistente: igual.
  assert.deepEqual(await solicitarCodigo(a.deps, { email: 'ninguem@teste.com', canal: 'WHATSAPP', telefone: '11912345678', ip: '14.0.0.2' }), { tipo: 'aceito' })
  assert.equal(a.enviados.length, 0)
  // Telefone cadastrado (com máscara e DDI).
  assert.deepEqual(await solicitarCodigo(a.deps, { email: 'lider@teste.com', canal: 'WHATSAPP', telefone: '+55 11 91234-5678', ip: '14.0.0.3' }), { tipo: 'aceito' })
  assert.equal(a.enviados.length, 1)
  assert.equal(a.enviados[0].canal, 'WHATSAPP')
  assert.equal(a.enviados[0].destino, '11912345678')
  assert.equal((await solicitarCodigo(a.deps, { email: 'lider@teste.com', canal: 'WHATSAPP', ip: '14.0.0.4' })).tipo, 'invalido')
  assert.equal((await solicitarCodigo(a.deps, { email: 'lider@teste.com', canal: 'SMS', ip: '14.0.0.4' })).tipo, 'invalido')
}

async function testeTabelaAusenteEAdmin() {
  novoLimitador()
  const a = ambiente()
  delete (a.tabelas as any).CodigoAcesso
  await assert.rejects(() => solicitarCodigo(a.deps, { email: 'lider@teste.com', ip: '15.0.0.1' }), RecursoNaoHabilitadoError)

  novoLimitador()
  const b = ambiente()
  b.deps.canalDisponivel = () => false
  await assert.rejects(() => solicitarCodigo(b.deps, { email: 'lider@teste.com', ip: '15.0.0.2' }), RecursoNaoHabilitadoError)

  // Administrador: com código válido ainda é recusado, sem sessão.
  novoLimitador()
  const c = ambiente()
  await solicitarCodigo(c.deps, { email: 'chefe@teste.com', ip: '15.0.0.3' })
  assert.deepEqual(await confirmarCodigo(c.deps, { email: 'chefe@teste.com', codigo: c.enviados[0].codigo, ip: '15.0.0.3' }), { tipo: 'admin' })

  novoLimitador()
  const d = ambiente()
  process.env.ADMIN_EMAIL = 'dono@teste.com'
  await solicitarCodigo(d.deps, { email: 'dono@teste.com', ip: '15.0.0.4' })
  assert.deepEqual(await confirmarCodigo(d.deps, { email: 'dono@teste.com', codigo: d.enviados[0].codigo, ip: '15.0.0.4' }), { tipo: 'admin' })
  delete process.env.ADMIN_EMAIL

  // Sem perfis: conta nova (onboarding).
  novoLimitador()
  const e = ambiente()
  await solicitarCodigo(e.deps, { email: 'novo@teste.com', ip: '15.0.0.5' })
  const r = await confirmarCodigo(e.deps, { email: 'novo@teste.com', codigo: e.enviados[0].codigo, ip: '15.0.0.5' })
  assert.equal(r.tipo, 'ok')
  if (r.tipo === 'ok') assert.equal(r.perfis.length, 0)

  // Organizador não liberado não vira perfil.
  novoLimitador()
  const f = ambiente()
  await solicitarCodigo(f.deps, { email: 'pendente@teste.com', ip: '15.0.0.6' })
  const rp = await confirmarCodigo(f.deps, { email: 'pendente@teste.com', codigo: f.enviados[0].codigo, ip: '15.0.0.6' })
  if (rp.tipo === 'ok') assert.equal(rp.perfis.length, 0)
}

async function testeTrocaDePerfil() {
  const a = ambiente({ PessoaPerfil: [{ perfil: 'LIDER', referenciaId: 'eq-1', emailNormalizado: 'lider@teste.com' }] })
  const sessao: any = { userId: 'eq-1', email: 'lider@teste.com', nome: 'x', tipo: 'equipe', status: 'APROVADA', emailVerificado: true, acesso: 'codigo' }
  const ok = await trocarPerfil(a.deps.db, sessao, { perfil: 'ORGANIZADOR', referenciaId: 'org-1' })
  assert.equal(ok.tipo, 'ok')
  // Perfil de outro e-mail (pendente@ e organizacao de outra pessoa) é recusado.
  a.tabelas.CandidaturaOrganizador.push({ id: 'org-9', email: 'outro@teste.com', nome: 'Outro', status: 'APROVADO' })
  const alheio = await trocarPerfil(a.deps.db, sessao, { perfil: 'ORGANIZADOR', referenciaId: 'org-9' })
  assert.equal(alheio.tipo === 'negado' ? alheio.status : 0, 404)
  // PessoaPerfil apontando para registro de outro e-mail e não liberado também não vale.
  a.tabelas.PessoaPerfil.push({ perfil: 'ORGANIZADOR', referenciaId: 'org-2', emailNormalizado: 'lider@teste.com' })
  assert.equal((await trocarPerfil(a.deps.db, sessao, { perfil: 'ORGANIZADOR', referenciaId: 'org-2' })).tipo, 'negado')
  // Sessão sem e-mail verificado (login por senha), onboarding e sem sessão.
  assert.equal(((await trocarPerfil(a.deps.db, { ...sessao, emailVerificado: undefined, acesso: undefined }, { perfil: 'LIDER', referenciaId: 'eq-1' })) as any).status, 403)
  assert.equal(((await trocarPerfil(a.deps.db, { ...sessao, onboarding: true }, { perfil: 'LIDER', referenciaId: 'eq-1' })) as any).status, 403)
  assert.equal(((await trocarPerfil(a.deps.db, null, { perfil: 'LIDER', referenciaId: 'eq-1' })) as any).status, 401)
  assert.equal(((await trocarPerfil(a.deps.db, sessao, { perfil: 'ADMIN', referenciaId: '1' })) as any).status, 400)
  // Administrador não troca para nada.
  const adm = { ...sessao, email: 'chefe@teste.com' }
  assert.equal(((await trocarPerfil(a.deps.db, adm, { perfil: 'LIDER', referenciaId: 'eq-1' })) as any).status, 403)
}

async function testeGoogle() {
  const base = (verificado: boolean | undefined) => ({
    user: {
      email: 'Pessoa@Gmail.com',
      identities: [{ provider: 'google', id: 'g-1', identity_data: { sub: 'sub-123', email_verified: verificado } }],
    },
  })
  assert.deepEqual(usuarioGoogleDaResposta(base(true)), { tipo: 'ok', usuario: { email: 'pessoa@gmail.com', sub: 'sub-123' } })
  assert.deepEqual(usuarioGoogleDaResposta(base(false)), { tipo: 'nao-verificado' })
  assert.deepEqual(usuarioGoogleDaResposta(base(undefined)), { tipo: 'nao-verificado' })
  assert.deepEqual(usuarioGoogleDaResposta({}), { tipo: 'falha' })

  const config = { url: 'https://x.supabase.co', anonKey: 'anon' }
  let chamada: any = null
  const fakeFetch = (async (url: string, init: any) => {
    chamada = { url, init }
    return { ok: true, json: async () => base(false) }
  }) as any
  assert.deepEqual(await trocarCodigoGoogle(config, 'c', 'v', fakeFetch), { tipo: 'nao-verificado' })
  assert.match(chamada.url, /\/auth\/v1\/token\?grant_type=pkce$/)
  assert.deepEqual(JSON.parse(chamada.init.body), { auth_code: 'c', code_verifier: 'v' })
  assert.deepEqual(await trocarCodigoGoogle(config, 'c', 'v', (async () => ({ ok: false })) as any), { tipo: 'falha' })

  const a = ambiente()
  assert.deepEqual(await vincularIdentidade(a.deps.db, { email: 'pessoa@gmail.com', sub: 's1' }), { tipo: 'ok' })
  assert.deepEqual(await vincularIdentidade(a.deps.db, { email: 'pessoa@gmail.com', sub: 's1' }), { tipo: 'ok' })
  assert.deepEqual(await vincularIdentidade(a.deps.db, { email: 'outra@gmail.com', sub: 's1' }), { tipo: 'conflito' })
  assert.equal(a.tabelas.IdentidadeExterna.length, 1)
  delete (a.tabelas as any).IdentidadeExterna
  await assert.rejects(() => vincularIdentidade(a.deps.db, { email: 'p@g.com', sub: 's2' }), RecursoNaoHabilitadoError)
}

async function testeMensageria() {
  const originalLog = console.info
  const linhas: string[] = []
  console.info = (...args: unknown[]) => { linhas.push(args.join(' ')) }
  const env = process.env as Record<string, string | undefined>
  const anterior = { node: env.NODE_ENV, flag: env.LOGIN_CODIGO_DEV_CONSOLE, smtp: env.SMTP_HOST }
  try {
    delete env.SMTP_HOST
    env.NODE_ENV = 'development'
    env.LOGIN_CODIGO_DEV_CONSOLE = '1'
    await enviarCodigo({ canal: 'EMAIL', destino: 'pessoa@teste.com', codigo: '424242' })
    assert.equal(linhas.length, 1)
    assert.ok(linhas[0].includes('424242'))
    assert.ok(!linhas[0].includes('pessoa@teste.com'), 'destino mascarado')

    env.NODE_ENV = 'production'
    await assert.rejects(() => enviarCodigo({ canal: 'EMAIL', destino: 'pessoa@teste.com', codigo: '424242' }))
    assert.equal(linhas.length, 1, 'produção nunca imprime o código')

    env.NODE_ENV = 'development'
    delete env.LOGIN_CODIGO_DEV_CONSOLE
    await assert.rejects(() => enviarCodigo({ canal: 'EMAIL', destino: 'pessoa@teste.com', codigo: '424242' }))
  } finally {
    console.info = originalLog
    if (anterior.node === undefined) delete env.NODE_ENV; else env.NODE_ENV = anterior.node
    if (anterior.flag === undefined) delete env.LOGIN_CODIGO_DEV_CONSOLE; else env.LOGIN_CODIGO_DEV_CONSOLE = anterior.flag
    if (anterior.smtp === undefined) delete env.SMTP_HOST; else env.SMTP_HOST = anterior.smtp
  }

  assert.equal(mascararDestino('pessoa@teste.com'), 'p***@teste.com')
  assert.equal(mascararDestino('11912345678'), '****5678')

  delete process.env.WHATSAPP_WEBHOOK_URL
  await assert.rejects(() => enviarPorWhatsapp({ canal: 'WHATSAPP', destino: '119', codigo: '1' }))
  process.env.WHATSAPP_WEBHOOK_URL = 'https://hook.exemplo/zap'
  process.env.WHATSAPP_WEBHOOK_TOKEN = 'tok'
  let req: any = null
  await enviarPorWhatsapp({ canal: 'WHATSAPP', destino: '11912345678', codigo: '123456' }, (async (url: string, init: any) => {
    req = { url, init }
    return { ok: true, status: 200 }
  }) as any)
  assert.equal(req.url, 'https://hook.exemplo/zap')
  assert.equal(req.init.headers.Authorization, 'Bearer tok')
  const corpo = JSON.parse(req.init.body)
  assert.equal(corpo.to, '11912345678')
  assert.ok(corpo.text.includes('123456'))
  await assert.rejects(() => enviarPorWhatsapp({ canal: 'WHATSAPP', destino: '1', codigo: '1' }, (async () => ({ ok: false, status: 500 })) as any))
  delete process.env.WHATSAPP_WEBHOOK_URL
  delete process.env.WHATSAPP_WEBHOOK_TOKEN
}

async function main() {
  await testeFlag()
  testeHash()
  await testeUniformeSemEnumeracao()
  await testeFluxoUsoUnicoEExpiracao()
  await testeTentativas()
  await testeRateLimit()
  await testeWhatsapp()
  await testeTabelaAusenteEAdmin()
  await testeTrocaDePerfil()
  await testeGoogle()
  await testeMensageria()
  definirStoreDeRateLimit(null)
  console.log('login-sem-senha: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
