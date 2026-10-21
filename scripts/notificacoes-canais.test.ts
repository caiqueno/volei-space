// Notificações multicanal (R18): preferências, assinatura push, entregas por canal, despachante com recuo exponencial e
// remoção de assinatura (404/410), cron com CRON_SECRET, lembretes sem duplicar, tabela publicada, flags e 503 sem tabela.
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-canais-com-32-caracteres-ok'

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
const C1 = uuid(1)
const T = [uuid(5), uuid(6), uuid(7), uuid(8)]
const AGORA = new Date('2026-10-21T12:00:00Z') // quarta, 09:00 em Brasília

function tabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}): Record<string, LinhaEscrita[]> {
  const insc = (id: string, timeId: string, ligaId: number, status: string, equipeLegadoId: number | null = null) => ({ id, ligaId, categoriaCampeonatoId: C1, timeId, status, equipeLegadoId })
  return {
    Notificacao: [],
    NotificacaoEntrega: [],
    PreferenciaNotificacao: [],
    PushAssinatura: [],
    LembreteEnviado: [],
    CandidaturaEquipe: [
      { id: 'lider0', email: 'lider0@volei.space', telefone: '(91) 98888-7777' },
      { id: 'lider1', email: 'lider1@volei.space', telefone: null },
      { id: 'lider2', email: 'lider2@volei.space', telefone: null },
      { id: 'membro0', email: 'membro0@volei.space', telefone: null },
    ],
    CandidaturaOrganizador: [{ id: 'org-1', email: 'org@volei.space', telefone: null }],
    ContaPublico: [],
    Liga: [
      { id: 1, nome: 'Copa Norte', status: 'ATIVA', simulacao: false, organizadorId: 'org-1', inscricoesAbertas: true, inscricoesEncerramentoEm: '2026-10-22T12:00:00Z' },
      { id: 2, nome: 'Copa Privada', status: 'ATIVA', simulacao: false, organizadorId: 'org-1', inscricoesAbertas: true, inscricoesEncerramentoEm: '2026-10-22T12:00:00Z', visibilidade: 'PRIVADA' },
      { id: 3, nome: 'Copa Distante', status: 'ATIVA', simulacao: false, organizadorId: 'org-1', inscricoesAbertas: true, inscricoesEncerramentoEm: '2026-10-30T12:00:00Z' },
      { id: 4, nome: 'Copa Antiga', status: 'FINALIZADO', simulacao: false, organizadorId: 'org-1', inscricoesAbertas: false, inscricoesEncerramentoEm: null },
    ],
    CategoriaCampeonato: [{ id: C1, ligaId: 1, nome: 'Adulto Feminino', codigo: 'FEMININO', removidaEm: null }],
    TimeClube: T.map((id, i) => ({ id, clubeId: `c${i}`, nome: ['Equipe Alfa', 'Equipe Beta', 'Equipe Gama', 'Equipe Delta'][i] })),
    MembroEquipe: [
      { timeId: T[0], usuarioId: 'lider0', papel: 'RESPONSAVEL' },
      { timeId: T[0], usuarioId: 'membro0', papel: 'ASSISTENTE' },
      { timeId: T[1], usuarioId: 'lider1', papel: 'RESPONSAVEL' },
      { timeId: T[2], usuarioId: 'lider2', papel: 'RESPONSAVEL' },
    ],
    Inscricao: [
      insc('i0', T[0], 1, 'RASCUNHO', 10), // rascunho na liga 1: recebe o lembrete de prazo
      insc('i1', T[1], 4, 'CONFIRMADA', 11), // jogou a Copa Antiga (mesmo organizador) e não entrou na liga 1
      insc('i2', T[2], 1, 'CONFIRMADA', 12), // já inscrita: sem lembrete de prazo
    ],
    Equipe: [{ id: 10, nome: 'Alfa' }, { id: 11, nome: 'Beta' }, { id: 12, nome: 'Gama' }],
    Partida: [
      { id: 100, ligaId: 1, equipeAId: 10, equipeBId: 12, dataHora: '2026-10-22T20:00:00Z', localNome: 'Ginásio Central', status: 'AGENDADA' }, // 17:00 BRT amanhã
      { id: 101, ligaId: 1, equipeAId: 12, equipeBId: 10, dataHora: '2026-10-23T02:30:00Z', localNome: 'A definir', status: 'AGENDADA' }, // 23:30 BRT amanhã
      { id: 102, ligaId: 1, equipeAId: 10, equipeBId: 12, dataHora: '2026-10-23T03:30:00Z', localNome: 'Ginásio Central', status: 'AGENDADA' }, // 00:30 de depois de amanhã
      { id: 103, ligaId: 1, equipeAId: 10, equipeBId: 12, dataHora: '2026-10-21T20:00:00Z', localNome: 'Ginásio Central', status: 'AGENDADA' }, // hoje
      { id: 104, ligaId: 1, equipeAId: 10, equipeBId: 12, dataHora: '2026-10-22T18:00:00Z', localNome: 'Ginásio Central', status: 'CANCELADA' },
    ],
    ...(extra as Record<string, LinhaEscrita[]>),
  }
}

function novoBanco(t: Record<string, LinhaEscrita[]>) {
  banco.atual = criarBancoEscrita(t, {
    unicos: {
      LembreteEnviado: [['chave']],
      PreferenciaNotificacao: [['usuarioId', 'canal', 'tipo']],
      PushAssinatura: [['endpoint']],
    },
  })
}

function req(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9', ...cabecalhos },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}
const json = async (r: Response) => (await r.json()) as any

const ENDPOINT = 'https://push.exemplo.com/send/abc123'
const CHAVES = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const como = async (userId: string, tipo: 'equipe' | 'organizador' | 'arbitro' = 'equipe') => {
    reiniciarCotas()
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo, status: 'ATIVA', trocarSenha: false })
  }
  const { recuoEmMs, MAXIMO_TENTATIVAS } = await import('../src/lib/notificacoes-canais/flags')
  const { assinarJwtVapid, enviarPushSemPayload } = await import('../src/lib/notificacoes-canais/push')
  const { processarEntregas, codigoDeErro } = await import('../src/lib/notificacoes-canais/despachante')
  const { gerarLembretes, intervaloDeAmanha, dataHoraBrasilia, notificarTabelaPublicada } = await import('../src/lib/notificacoes-canais/lembretes')
  const { notificar } = await import('../src/lib/meu-time-fase2/notificacoes')
  const pref = await import('../src/app/api/notificacoes/preferencias/route')
  const assinar = await import('../src/app/api/notificacoes/push/assinar/route')
  const chave = await import('../src/app/api/notificacoes/push/chave/route')
  const cronNotif = await import('../src/app/api/cron/notificacoes/route')
  const cronLembretes = await import('../src/app/api/cron/lembretes/route')

  // --- 0. Peças puras ------------------------------------------------------------------------------------
  assert.deepEqual([1, 2, 3, 4].map(recuoEmMs), [60_000, 120_000, 240_000, 480_000], 'recuo exponencial')
  assert.equal(MAXIMO_TENTATIVAS, 5)
  assert.equal(codigoDeErro(Object.assign(new Error('falhou para x@y.com'), { code: 'EAUTH' })), 'EAUTH')
  assert.equal(codigoDeErro(new Error('Webhook de WhatsApp respondeu 502.')), 'HTTP_502')
  assert.equal(codigoDeErro(new Error('erro com 91988887777')), 'ERRO_ENVIO', 'nunca devolve o texto da exceção')
  assert.equal(dataHoraBrasilia('2026-10-22T20:00:00Z'), '22/10 às 17:00')
  const am = intervaloDeAmanha(AGORA)
  assert.deepEqual([am.inicio.toISOString(), am.fim.toISOString()], ['2026-10-22T03:00:00.000Z', '2026-10-23T03:00:00.000Z'], 'amanhã em Brasília')
  const tarde = intervaloDeAmanha(new Date('2026-10-22T01:30:00Z')) // ainda é dia 21 em Brasília
  assert.equal(tarde.inicio.toISOString(), '2026-10-22T03:00:00.000Z')

  // VAPID: JWT ES256 verificável com a chave pública.
  const par = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = par.privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string }
  const publica = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url')
  const env = { VAPID_PUBLIC_KEY: publica, VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:contato@volei.space' }
  const jwt = assinarJwtVapid('https://push.exemplo.com', AGORA.getTime(), env)
  const [cab, corpoJwt, assinatura] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(cab, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' })
  const claims = JSON.parse(Buffer.from(corpoJwt, 'base64url').toString())
  assert.equal(claims.aud, 'https://push.exemplo.com')
  assert.equal(claims.sub, 'mailto:contato@volei.space')
  assert.ok(claims.exp > AGORA.getTime() / 1000 && claims.exp - AGORA.getTime() / 1000 <= 24 * 3600)
  assert.equal(
    verify('sha256', Buffer.from(`${cab}.${corpoJwt}`), { key: par.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(assinatura, 'base64url')),
    true,
    'assinatura ES256 confere',
  )
  assert.throws(() => assinarJwtVapid('https://x', AGORA.getTime(), {}), /VAPID_NAO_CONFIGURADO/)
  // O push sai sem corpo e com o cabeçalho VAPID.
  const chamadas: Array<{ url: string; init: RequestInit }> = []
  const falso = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return new Response(null, { status: 201 }) }) as unknown as typeof fetch
  assert.deepEqual(await enviarPushSemPayload({ endpoint: ENDPOINT }, falso, AGORA.getTime(), env), { ok: true })
  assert.equal(chamadas[0].init.body, undefined, 'sem payload')
  assert.match(String((chamadas[0].init.headers as Record<string, string>).Authorization), /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
  const gone = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch
  assert.deepEqual(await enviarPushSemPayload({ endpoint: ENDPOINT }, gone, AGORA.getTime(), env), { ok: false, status: 410, remover: true, erro: 'HTTP_410' })

  // --- 1. Flag desligada: 404 em tudo ---------------------------------------------------------------------------
  process.env.CRON_SECRET = 'segredo-do-cron'
  delete process.env.NOTIFICACOES_MULTICANAL_ATIVO
  novoBanco(tabelas())
  await como('lider0')
  assert.equal((await pref.GET(req('GET', '/x'))).status, 404)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'EMAIL', tipo: 'JOGO_AMANHA', ativo: true }))).status, 404)
  assert.equal((await assinar.POST(req('POST', '/x', { endpoint: ENDPOINT, chaves: CHAVES }))).status, 404)
  assert.equal((await assinar.DELETE(req('DELETE', '/x', { endpoint: ENDPOINT }))).status, 404)
  assert.equal((await chave.GET(req('GET', '/x'))).status, 404)
  const auth = { authorization: 'Bearer segredo-do-cron' }
  assert.equal((await cronNotif.POST(req('POST', '/x', undefined, auth))).status, 404)
  assert.equal((await cronLembretes.GET(req('GET', '/x', undefined, auth))).status, 404)
  // Com a flag desligada `notificar` só grava a interna.
  const t0 = tabelas()
  novoBanco(t0)
  assert.equal(await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste', 'Texto'), true)
  assert.equal(t0.Notificacao.length, 1)
  assert.equal(t0.NotificacaoEntrega.length, 0)
  assert.equal((await notificarTabelaPublicada(1, C1, AGORA)), 0)

  process.env.NOTIFICACOES_MULTICANAL_ATIVO = '1'

  // --- 2. Autenticação ---------------------------------------------------------------------------------------------
  sessao.token = null
  assert.equal((await pref.GET(req('GET', '/x'))).status, 401)
  await como('arb', 'arbitro')
  assert.equal((await pref.GET(req('GET', '/x'))).status, 401)

  // --- 3. Preferências ---------------------------------------------------------------------------------------------------
  let t = tabelas()
  novoBanco(t)
  await como('lider0')
  const p1 = await json(await pref.GET(req('GET', '/x')))
  const achar = (itens: any[], canal: string, tipo: string) => itens.find((i) => i.canal === canal && i.tipo === tipo)
  assert.equal(achar(p1.data.itens, 'EMAIL', 'AJUSTE_PEDIDO').ativo, true, 'e-mail ligado por padrão nos tipos críticos')
  assert.equal(achar(p1.data.itens, 'EMAIL', 'CONVITE_ACEITO').ativo, false)
  assert.equal(achar(p1.data.itens, 'WHATSAPP', 'AJUSTE_PEDIDO').ativo, false, 'WhatsApp só se o usuário ativar')
  assert.equal(achar(p1.data.itens, 'PUSH', 'JOGO_AMANHA').ativo, false, 'push só se o usuário ativar')
  assert.equal(p1.data.itens.length, 3 * 15)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'SMS', tipo: 'JOGO_AMANHA', ativo: true }))).status, 422)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'EMAIL', tipo: 'INVENTADO', ativo: true }))).status, 422)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'EMAIL', tipo: 'JOGO_AMANHA', ativo: 'sim' }))).status, 422)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'WHATSAPP', tipo: 'JOGO_AMANHA', ativo: true }))).status, 200)
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'WHATSAPP', tipo: 'JOGO_AMANHA', ativo: true }))).status, 200, 'idempotente')
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'EMAIL', tipo: 'AJUSTE_PEDIDO', ativo: false }))).status, 200)
  assert.equal(t.PreferenciaNotificacao.length, 2)
  const p2 = await json(await pref.GET(req('GET', '/x')))
  assert.equal(achar(p2.data.itens, 'WHATSAPP', 'JOGO_AMANHA').ativo, true)
  assert.equal(achar(p2.data.itens, 'EMAIL', 'AJUSTE_PEDIDO').ativo, false)
  await como('lider1')
  const p3 = await json(await pref.GET(req('GET', '/x')))
  assert.equal(achar(p3.data.itens, 'WHATSAPP', 'JOGO_AMANHA').ativo, false, 'preferência é de cada usuário')
  await como('org-1', 'organizador')
  assert.equal((await pref.GET(req('GET', '/x'))).status, 200, 'organizador também tem preferências')
  const semPref = tabelas()
  delete (semPref as any).PreferenciaNotificacao
  novoBanco(semPref)
  await como('lider0')
  const pr503 = await pref.GET(req('GET', '/x'))
  assert.equal(pr503.status, 503)
  assert.equal((await json(pr503)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await pref.PUT(req('PUT', '/x', { canal: 'EMAIL', tipo: 'JOGO_AMANHA', ativo: true }))).status, 503)

  // --- 4. Assinatura push --------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  await como('lider0')
  for (const endpoint of ['http://push.exemplo.com/x', 'https://localhost/x', 'https://10.0.0.5/x', 'https://192.168.1.1/x', 'nao-e-url', 'https://user:senha@push.exemplo.com/x']) {
    assert.equal((await assinar.POST(req('POST', '/x', { endpoint, chaves: CHAVES }))).status, 422, endpoint)
  }
  assert.equal((await assinar.POST(req('POST', '/x', { endpoint: ENDPOINT, chaves: { p256dh: 'curta', auth: CHAVES.auth } }))).status, 422)
  assert.equal((await assinar.POST(req('POST', '/x', { endpoint: ENDPOINT, chaves: CHAVES }))).status, 200)
  assert.equal((await assinar.POST(req('POST', '/x', { endpoint: ENDPOINT, chaves: CHAVES }))).status, 200, 'idempotente')
  assert.equal(t.PushAssinatura.length, 1)
  assert.equal(t.PushAssinatura[0].usuarioId, 'lider0')
  await como('lider1')
  assert.equal((await assinar.DELETE(req('DELETE', '/x', { endpoint: ENDPOINT }))).status, 200, 'cancelar assinatura alheia não faz nada')
  assert.equal(t.PushAssinatura.length, 1)
  await como('lider0')
  assert.equal((await assinar.DELETE(req('DELETE', '/x', { endpoint: ENDPOINT }))).status, 200)
  assert.equal(t.PushAssinatura.length, 0)
  assert.equal((await assinar.DELETE(req('DELETE', '/x', { endpoint: ENDPOINT }))).status, 200, 'idempotente')
  // Chave pública VAPID.
  delete process.env.VAPID_PUBLIC_KEY
  assert.equal((await chave.GET(req('GET', '/x'))).status, 503)
  process.env.VAPID_PUBLIC_KEY = publica
  const ch = await json(await chave.GET(req('GET', '/x')))
  assert.deepEqual(ch, { data: { chave: publica } })
  assert.ok(!JSON.stringify(ch).includes(jwk.d), 'a privada nunca sai')
  const semPush = tabelas()
  delete (semPush as any).PushAssinatura
  novoBanco(semPush)
  assert.equal((await assinar.POST(req('POST', '/x', { endpoint: ENDPOINT, chaves: CHAVES }))).status, 503)

  // --- 5. notificar cria as entregas conforme as preferências --------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  assert.equal(await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste', 'Texto'), true)
  assert.equal(t.Notificacao.length, 1, 'a interna sempre existe')
  assert.deepEqual(t.NotificacaoEntrega.map((e) => [e.canal, e.estado, e.tentativas]), [['EMAIL', 'PENDENTE', 0]], 'tipo crítico: só e-mail por padrão')
  assert.equal(t.NotificacaoEntrega[0].notificacaoId, t.Notificacao[0].id)
  assert.equal(JSON.stringify(t.NotificacaoEntrega).includes('@'), false, 'a entrega não guarda e-mail')
  await notificar('lider0', 'CONVITE_ACEITO', 'Convite', 'Texto')
  assert.equal(t.NotificacaoEntrega.length, 1, 'tipo não crítico: sem e-mail por padrão')
  t.PreferenciaNotificacao.push({ id: 'p1', usuarioId: 'lider0', canal: 'EMAIL', tipo: 'AJUSTE_PEDIDO', ativo: false })
  await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste', 'Texto')
  assert.equal(t.NotificacaoEntrega.length, 1, 'e-mail desligado pelo usuário')
  // WhatsApp ativado: exige telefone cadastrado.
  t.PreferenciaNotificacao.push({ id: 'p2', usuarioId: 'lider0', canal: 'WHATSAPP', tipo: 'JOGO_AMANHA', ativo: true }, { id: 'p3', usuarioId: 'lider1', canal: 'WHATSAPP', tipo: 'JOGO_AMANHA', ativo: true })
  await notificar('lider0', 'JOGO_AMANHA', 'Jogo', 'Texto')
  await notificar('lider1', 'JOGO_AMANHA', 'Jogo', 'Texto')
  const canais = t.NotificacaoEntrega.map((e) => `${e.canal}`)
  assert.equal(canais.filter((c) => c === 'WHATSAPP').length, 1, 'só quem tem telefone válido')
  // Push ativado: exige assinatura.
  t.PreferenciaNotificacao.push({ id: 'p4', usuarioId: 'lider0', canal: 'PUSH', tipo: 'TABELA_PUBLICADA', ativo: true })
  await notificar('lider0', 'TABELA_PUBLICADA', 'Tabela', 'Texto')
  assert.equal(t.NotificacaoEntrega.some((e) => e.canal === 'PUSH'), false, 'sem assinatura não há push')
  t.PushAssinatura.push({ id: 'ps1', usuarioId: 'lider0', endpoint: ENDPOINT, chaveP256dh: 'x', chaveAuth: 'y' })
  await notificar('lider0', 'TABELA_PUBLICADA', 'Tabela', 'Texto')
  assert.equal(t.NotificacaoEntrega.filter((e) => e.canal === 'PUSH').length, 1)
  // Tabela de entregas ausente: a notificação interna continua valendo.
  const semEntrega = tabelas()
  delete (semEntrega as any).NotificacaoEntrega
  novoBanco(semEntrega)
  assert.equal(await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste', 'Texto'), true)
  assert.equal(semEntrega.Notificacao.length, 1)

  // --- 6. Despachante: envio, recuo exponencial, tentativas, limite --------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste na inscrição', 'Equipe Alfa precisa de ajustes.')
  const enviados: Array<{ para: string; assunto: string; html: string }> = []
  let falhar = true
  const depsEmail = (agora: Date) => ({
    agora: () => agora,
    enviarEmail: async (para: string, assunto: string, html: string) => {
      if (falhar) throw Object.assign(new Error(`SMTP recusou ${para}`), { code: 'ECONNECTION' })
      enviados.push({ para, assunto, html })
    },
  })
  const entrega = () => t.NotificacaoEntrega[0]
  // O relógio do teste é o AGORA fixo: alinha as entregas criadas por `notificar` (que usa o relógio real).
  const alinhar = () => t.NotificacaoEntrega.forEach((e) => { e.criadoEm = AGORA.toISOString(); e.proximaTentativaEm = AGORA.toISOString() })
  alinhar()
  let r = await processarEntregas(depsEmail(AGORA))
  assert.deepEqual(r, { processadas: 1, enviadas: 0, reagendadas: 1, falhas: 0, ignoradas: 0 })
  assert.equal(entrega().estado, 'PENDENTE')
  assert.equal(entrega().tentativas, 1)
  assert.equal(entrega().erro, 'ECONNECTION', 'só o código, sem e-mail nem texto da exceção')
  assert.equal(entrega().proximaTentativaEm, new Date(AGORA.getTime() + 60_000).toISOString(), '1ª falha: 1 min')
  // Antes da hora não reenvia.
  r = await processarEntregas(depsEmail(new Date(AGORA.getTime() + 30_000)))
  assert.equal(r.processadas, 0)
  assert.equal(entrega().tentativas, 1)
  // 2ª falha: 2 min; 3ª: 4 min; 4ª: 8 min.
  let relogio = AGORA.getTime() + 60_000
  for (const [n, espera] of [[2, 120_000], [3, 240_000], [4, 480_000]] as Array<[number, number]>) {
    r = await processarEntregas(depsEmail(new Date(relogio)))
    assert.equal(r.reagendadas, 1)
    assert.equal(entrega().tentativas, n)
    assert.equal(entrega().proximaTentativaEm, new Date(relogio + espera).toISOString(), `${n}ª falha`)
    relogio += espera
  }
  // 5ª tentativa falha: FALHOU, e não é mais processada.
  r = await processarEntregas(depsEmail(new Date(relogio)))
  assert.equal(r.falhas, 1)
  assert.equal(entrega().estado, 'FALHOU')
  assert.equal(entrega().tentativas, 5)
  r = await processarEntregas(depsEmail(new Date(relogio + 3_600_000)))
  assert.equal(r.processadas, 0)
  // Sucesso: ENVIADA, texto sem dado pessoal além do que já estava na notificação.
  t.NotificacaoEntrega.length = 0
  await notificar('lider0', 'AJUSTE_PEDIDO', 'Ajuste <b>', 'Equipe Alfa precisa de ajustes.')
  alinhar()
  falhar = false
  r = await processarEntregas(depsEmail(AGORA))
  assert.equal(r.enviadas, 1)
  assert.equal(entrega().estado, 'ENVIADA')
  assert.equal(entrega().enviadoEm, AGORA.toISOString())
  assert.equal(enviados[0].para, 'lider0@volei.space')
  assert.ok(enviados[0].html.includes('Ajuste &lt;b&gt;'), 'html escapado')
  // Sem e-mail cadastrado: ignorada (não insiste).
  t.NotificacaoEntrega.length = 0
  t.CandidaturaEquipe.find((c) => c.id === 'lider0')!.email = null
  t.NotificacaoEntrega.push({ id: 'e1', notificacaoId: t.Notificacao[0].id, canal: 'EMAIL', estado: 'PENDENTE', tentativas: 0, criadoEm: AGORA.toISOString(), proximaTentativaEm: AGORA.toISOString() })
  r = await processarEntregas(depsEmail(AGORA))
  assert.equal(r.ignoradas, 1)
  assert.equal(entrega().erro, 'SEM_EMAIL')
  t.CandidaturaEquipe.find((c) => c.id === 'lider0')!.email = 'lider0@volei.space'
  // Duas execuções ao mesmo tempo não enviam duas vezes.
  t.NotificacaoEntrega.length = 0
  enviados.length = 0
  t.NotificacaoEntrega.push({ id: 'e2', notificacaoId: t.Notificacao[0].id, canal: 'EMAIL', estado: 'PENDENTE', tentativas: 0, criadoEm: AGORA.toISOString(), proximaTentativaEm: AGORA.toISOString() })
  await Promise.all([processarEntregas(depsEmail(AGORA)), processarEntregas(depsEmail(AGORA))])
  assert.equal(enviados.length, 1, 'reivindicação evita envio duplicado')
  // Limite por execução.
  t.NotificacaoEntrega.length = 0
  for (let i = 0; i < 5; i += 1) {
    t.NotificacaoEntrega.push({ id: `l${i}`, notificacaoId: t.Notificacao[0].id, canal: 'EMAIL', estado: 'PENDENTE', tentativas: 0, criadoEm: `2026-10-21T11:0${i}:00Z`, proximaTentativaEm: AGORA.toISOString() })
  }
  r = await processarEntregas({ ...depsEmail(AGORA), limite: 2 })
  assert.equal(r.processadas, 2)
  assert.equal(t.NotificacaoEntrega.filter((e) => e.estado === 'PENDENTE').length, 3)

  // WhatsApp: só para telefone cadastrado, sem telefone no registro da entrega.
  t = tabelas()
  novoBanco(t)
  const nova = (id: string, usuarioId: string, tipo: string, mensagem: string) => t.Notificacao.push({ id, usuarioId, tipo, titulo: 'Jogo amanhã', mensagem, dados: null, lidaEm: null })
  const entregaManual = (id: string, notificacaoId: string, canal: string) => t.NotificacaoEntrega.push({ id, notificacaoId, canal, estado: 'PENDENTE', tentativas: 0, criadoEm: AGORA.toISOString(), proximaTentativaEm: AGORA.toISOString() })
  nova('n-w1', 'lider0', 'JOGO_AMANHA', 'Alfa x Gama.')
  nova('n-w2', 'lider1', 'JOGO_AMANHA', 'Beta x Gama.')
  entregaManual('w1', 'n-w1', 'WHATSAPP')
  const zaps: Array<{ destino: string; texto: string }> = []
  r = await processarEntregas({ agora: () => AGORA, enviarWhatsapp: async (destino, texto) => { zaps.push({ destino, texto }) } })
  assert.equal(r.enviadas, 1)
  assert.equal(zaps[0].destino, '91988887777')
  assert.equal(zaps[0].texto, 'Jogo amanhã: Alfa x Gama.')
  assert.ok(!JSON.stringify(t.NotificacaoEntrega).includes('9198888'), 'telefone nunca fica na entrega')
  entregaManual('w2', 'n-w2', 'WHATSAPP')
  r = await processarEntregas({ agora: () => AGORA, enviarWhatsapp: async () => { throw new Error('não deveria enviar') } })
  assert.equal(r.ignoradas, 1)
  assert.equal(t.NotificacaoEntrega.find((e) => e.id === 'w2')!.erro, 'SEM_TELEFONE')

  // Push: 410 e 404 removem a assinatura; falha comum mantém e registra o código.
  t = tabelas()
  novoBanco(t)
  t.Notificacao.push({ id: 'n-push', usuarioId: 'lider0', tipo: 'AJUSTE_PEDIDO', titulo: 'Ajuste', mensagem: 'Texto', dados: null, lidaEm: null })
  const idPush = 'n-push'
  const pushEntrega = (id: string) => t.NotificacaoEntrega.push({ id, notificacaoId: idPush, canal: 'PUSH', estado: 'PENDENTE', tentativas: 0, criadoEm: AGORA.toISOString(), proximaTentativaEm: AGORA.toISOString() })
  t.NotificacaoEntrega.length = 0
  t.PushAssinatura.push(
    { id: 'a410', usuarioId: 'lider0', endpoint: 'https://push.exemplo.com/410' },
    { id: 'a404', usuarioId: 'lider0', endpoint: 'https://push.exemplo.com/404' },
  )
  pushEntrega('p-gone')
  const respostas: Record<string, { ok: boolean; status: number | null; remover: boolean; erro: string }> = {
    'https://push.exemplo.com/410': { ok: false, status: 410, remover: true, erro: 'HTTP_410' },
    'https://push.exemplo.com/404': { ok: false, status: 404, remover: true, erro: 'HTTP_404' },
  }
  r = await processarEntregas({ agora: () => AGORA, enviarPush: async (a) => respostas[a.endpoint] as any })
  assert.equal(t.PushAssinatura.length, 0, 'assinaturas mortas removidas')
  assert.equal(r.ignoradas, 1)
  assert.equal(t.NotificacaoEntrega[0].erro, 'ASSINATURA_REMOVIDA_HTTP_404')
  // Uma viva e uma morta: envia e remove só a morta.
  t.NotificacaoEntrega.length = 0
  t.PushAssinatura.push({ id: 'viva', usuarioId: 'lider0', endpoint: 'https://push.exemplo.com/ok' }, { id: 'morta', usuarioId: 'lider0', endpoint: 'https://push.exemplo.com/410' })
  pushEntrega('p-mista')
  r = await processarEntregas({
    agora: () => AGORA,
    enviarPush: async (a) => (a.endpoint.endsWith('/410') ? ({ ok: false, status: 410, remover: true, erro: 'HTTP_410' } as const) : ({ ok: true } as const)),
  })
  assert.equal(r.enviadas, 1)
  assert.deepEqual(t.PushAssinatura.map((a) => a.id), ['viva'])
  // Erro de rede: mantém a assinatura, registra o código e reagenda.
  t.NotificacaoEntrega.length = 0
  pushEntrega('p-rede')
  r = await processarEntregas({ agora: () => AGORA, enviarPush: async () => ({ ok: false, status: 503, remover: false, erro: 'HTTP_503' }) })
  assert.equal(r.reagendadas, 1)
  assert.equal(t.PushAssinatura.length, 1)
  assert.equal(t.PushAssinatura[0].ultimoErro, 'HTTP_503')
  // Sem assinatura: ignorada.
  t.PushAssinatura.length = 0
  t.NotificacaoEntrega.length = 0
  pushEntrega('p-vazio')
  r = await processarEntregas({ agora: () => AGORA, enviarPush: async () => ({ ok: true }) })
  assert.equal(r.ignoradas, 1)

  // --- 7. Cron: segredo, 404/401/503 -------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  delete process.env.CRON_SECRET
  assert.equal((await cronNotif.POST(req('POST', '/x', undefined, auth))).status, 404, 'sem CRON_SECRET a rota não existe')
  assert.equal((await cronLembretes.POST(req('POST', '/x', undefined, auth))).status, 404)
  process.env.CRON_SECRET = 'segredo-do-cron'
  assert.equal((await cronNotif.POST(req('POST', '/x'))).status, 401)
  assert.equal((await cronNotif.POST(req('POST', '/x', undefined, { authorization: 'Bearer errado' }))).status, 401)
  assert.equal((await cronNotif.POST(req('POST', '/x', undefined, { authorization: 'segredo-do-cron' }))).status, 401, 'exige o esquema Bearer')
  assert.equal((await cronLembretes.POST(req('POST', '/x', undefined, { authorization: 'Bearer errado' }))).status, 401)
  const ok = await cronNotif.POST(req('POST', '/x', undefined, auth))
  assert.equal(ok.status, 200)
  assert.deepEqual((await json(ok)).data, { processadas: 0, enviadas: 0, reagendadas: 0, falhas: 0, ignoradas: 0 })
  assert.equal((await cronNotif.GET(req('GET', '/x', undefined, auth))).status, 200, 'a Vercel cron chama por GET')
  const semTabelaEntrega = tabelas()
  delete (semTabelaEntrega as any).NotificacaoEntrega
  novoBanco(semTabelaEntrega)
  const c503 = await cronNotif.POST(req('POST', '/x', undefined, auth))
  assert.equal(c503.status, 503)
  assert.equal((await json(c503)).error, 'Recurso ainda não habilitado neste ambiente.')

  // --- 8. Lembretes sem duplicar --------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  // lider2 desliga o e-mail de "jogo amanhã"; lider0 mantém o padrão (JOGO_AMANHA é crítico).
  t.PreferenciaNotificacao.push({ id: 'p9', usuarioId: 'lider2', canal: 'EMAIL', tipo: 'JOGO_AMANHA', ativo: false })
  const g1 = await gerarLembretes(AGORA)
  assert.deepEqual(g1, { prazo: 2, jogo: 6, duplicados: 0, falhas: 0 })
  const por = (tipo: string) => t.Notificacao.filter((n) => n.tipo === tipo)
  // Prazo: lider0 (rascunho) e lider1 (jogou outra do organizador). Não: lider2 (já inscrita), privada, prazo distante.
  assert.deepEqual(por('PRAZO_INSCRICAO').map((n) => n.usuarioId).sort(), ['lider0', 'lider1'])
  const prazo0 = por('PRAZO_INSCRICAO').find((n) => n.usuarioId === 'lider0')!
  assert.equal(prazo0.mensagem, 'O prazo de inscrição de Copa Norte termina em 22/10 às 09:00. Falta concluir a inscrição de Equipe Alfa.')
  assert.equal(por('PRAZO_INSCRICAO').find((n) => n.usuarioId === 'lider1')!.mensagem, 'O prazo de inscrição de Copa Norte termina em 22/10 às 09:00. Equipe Beta ainda não está inscrito.')
  // Jogo amanhã: partidas 100 (17:00) e 101 (23:30) de 22/10 em Brasília; 102 (00:30 de 23/10), 103 (hoje) e 104 (cancelada) ficam de fora.
  const jogos = por('JOGO_AMANHA')
  assert.equal(jogos.length, 6, '3 membros (lider0 e membro0 de Alfa, lider2 de Gama) x 2 partidas')
  assert.deepEqual(jogos.map((n) => n.usuarioId).sort(), ['lider0', 'lider0', 'lider2', 'lider2', 'membro0', 'membro0'])
  assert.ok(jogos.some((n) => n.mensagem === 'Jogo amanhã: Alfa x Gama, 22/10 às 17:00, Ginásio Central.'))
  assert.ok(jogos.some((n) => n.mensagem === 'Jogo amanhã: Gama x Alfa, 22/10 às 23:30, local a definir.'))
  await gerarLembretes(AGORA)
  assert.equal(t.Notificacao.length, 2 + g1.jogo, 'segunda execução não duplica')
  assert.deepEqual(await gerarLembretes(AGORA), { prazo: 0, jogo: 0, duplicados: 2 + g1.jogo, falhas: 0 })
  assert.ok(!/Maria|CPF|cpf|telefone|@/.test(JSON.stringify(t.Notificacao.map((n) => n.mensagem))), 'sem dado pessoal')
  // As preferências decidem os canais: e-mail para lider0, nenhum para lider2.
  const emailsDeJogo = t.NotificacaoEntrega.filter((e) => e.canal === 'EMAIL' && por('JOGO_AMANHA').some((n) => n.id === e.notificacaoId))
  assert.ok(emailsDeJogo.length > 0)
  assert.ok(!emailsDeJogo.some((e) => por('JOGO_AMANHA').find((n) => n.id === e.notificacaoId)!.usuarioId === 'lider2'), 'lider2 desligou o e-mail')
  // Cron de lembretes pela rota.
  const semLembrete = tabelas()
  delete (semLembrete as any).LembreteEnviado
  novoBanco(semLembrete)
  const l503 = await cronLembretes.POST(req('POST', '/x', undefined, auth))
  assert.equal(l503.status, 503, 'sem a tabela de lembretes não há como evitar duplicidade: não envia')
  assert.equal(semLembrete.Notificacao.length, 0)
  novoBanco(tabelas())
  assert.equal((await cronLembretes.POST(req('POST', '/x', undefined, auth))).status, 200)

  // --- 9. Tabela publicada (evento) -------------------------------------------------------------------------------------------------------
  t = tabelas()
  novoBanco(t)
  t.Inscricao.find((i) => i.id === 'i2')!.status = 'REMOVIDA'
  assert.equal(await notificarTabelaPublicada(1, C1, AGORA), 0, 'ninguém confirmado na categoria ainda')
  t.Inscricao.find((i) => i.id === 'i2')!.status = 'CONFIRMADA'
  t.Inscricao.find((i) => i.id === 'i0')!.status = 'CONFIRMADA'
  assert.equal(await notificarTabelaPublicada(1, C1, AGORA), 3, 'membros de Alfa (lider0, membro0) e de Gama (lider2)')
  assert.deepEqual(t.Notificacao.filter((n) => n.tipo === 'TABELA_PUBLICADA').map((n) => n.usuarioId).sort(), ['lider0', 'lider2', 'membro0'])
  assert.equal(t.Notificacao[0].mensagem, 'A tabela de jogos de Adulto Feminino em Copa Norte foi publicada.')
  assert.equal(await notificarTabelaPublicada(1, C1, AGORA), 0, 'regerar no mesmo dia não repete')
  assert.equal(await notificarTabelaPublicada(1, C1, new Date(AGORA.getTime() + 86_400_000)), 3, 'outro dia, nova publicação')
  const semLemb = tabelas()
  delete (semLemb as any).LembreteEnviado
  novoBanco(semLemb)
  assert.equal(await notificarTabelaPublicada(1, C1, AGORA), 0, 'nunca lança, mesmo sem a tabela')

  console.log('notificacoes-canais.test.ts: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
