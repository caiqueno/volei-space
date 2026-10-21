import assert from 'node:assert/strict'
import { criarClienteCanais } from '../src/components/notificacoes-canais/cliente'
import {
  bytesParaBase64Url,
  CANAIS,
  chaveVapidParaBytes,
  chaveVapidValida,
  comPreferencia,
  corpoDaAssinatura,
  estadoDoPush,
  normalizarPreferencias,
  notificacoesMulticanalAtivo,
  suportaPush,
  textoDoPush,
  textoFalhaPush,
  textoResultadoPermissao,
  tiposDisponiveis,
  valorDaPreferencia,
  type AmbientePush,
} from '../src/lib/notificacoes-canais-ui/regras'

// flag
assert.equal(notificacoesMulticanalAtivo('1'), true)
assert.equal(notificacoesMulticanalAtivo('0'), false)
assert.equal(notificacoesMulticanalAtivo(undefined), false)

// chave VAPID base64url
const bytes65 = new Uint8Array(65)
bytes65[0] = 4
for (let i = 1; i < 65; i++) bytes65[i] = (i * 7) % 256
const chave = bytesParaBase64Url(bytes65)
assert.equal(/[+/=]/.test(chave), false)
assert.deepEqual(Array.from(chaveVapidParaBytes(chave) ?? []), Array.from(bytes65))
assert.equal(chaveVapidValida(chave), true)
assert.equal(chaveVapidValida(`${chave}=`), true)
// caracteres - e _ (equivalentes a + e /)
assert.deepEqual(Array.from(chaveVapidParaBytes('-_8') ?? []), [0xfb, 0xff])
assert.deepEqual(Array.from(chaveVapidParaBytes('SGVsbG8') ?? []), Array.from(Buffer.from('Hello')))
assert.equal(chaveVapidParaBytes(''), null)
assert.equal(chaveVapidParaBytes('a+b/c'), null)
assert.equal(chaveVapidParaBytes('abcde'), null)
assert.equal(chaveVapidValida('SGVsbG8'), false)
assert.equal(chaveVapidValida(bytesParaBase64Url(new Uint8Array(65))), false)
assert.equal(bytesParaBase64Url(null), '')

// permissão e suporte
const base: AmbientePush = { temServiceWorker: true, temPushManager: true, temNotification: true, contextoSeguro: true, permissao: 'default', assinado: false }
assert.equal(suportaPush(base), true)
assert.equal(estadoDoPush(base), 'pronta')
assert.equal(estadoDoPush({ ...base, permissao: 'denied' }), 'negada')
assert.equal(estadoDoPush({ ...base, permissao: 'granted' }), 'concedida')
assert.equal(estadoDoPush({ ...base, permissao: 'granted', assinado: true }), 'ativa')
assert.equal(estadoDoPush({ ...base, temPushManager: false }), 'sem-suporte')
assert.equal(estadoDoPush({ ...base, contextoSeguro: false }), 'sem-suporte')
assert.equal(estadoDoPush({ ...base, temNotification: false, permissao: null }), 'sem-suporte')
// sem suporte e negada nunca oferecem o botão de ativar
assert.equal(textoDoPush('sem-suporte').botao, null)
assert.equal(textoDoPush('negada').botao, null)
assert.equal(textoDoPush('pronta').botao, 'Ativar avisos neste aparelho')
assert.equal(textoDoPush('concedida').botao, 'Ativar avisos neste aparelho')
assert.match(textoDoPush('pronta').explicacao, /perguntar/)
assert.match(textoResultadoPermissao('denied'), /configurações/)
assert.match(textoResultadoPermissao('default'), /de novo/)
for (const f of ['chave', 'rede', 'registro', 'assinatura', 'servidor'] as const) assert.ok(textoFalhaPush(f).length > 10)

// corpo da assinatura
assert.deepEqual(corpoDaAssinatura({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' }, expirationTime: null }), { endpoint: 'https://push.example/abc', chaves: { p256dh: 'P', auth: 'A' } })
assert.equal(corpoDaAssinatura({ endpoint: 'http://inseguro', keys: { p256dh: 'P', auth: 'A' } }), null)
assert.equal(corpoDaAssinatura({ endpoint: 'https://x', keys: { p256dh: 'P' } }), null)
assert.equal(corpoDaAssinatura(null), null)

// preferências
assert.equal(CANAIS.length, 3)
const prefs = normalizarPreferencias({ itens: [{ canal: 'EMAIL', tipo: 'JOGO', ativo: false }, { canal: 'SMS', tipo: 'JOGO', ativo: true }, { canal: 'EMAIL', tipo: 'JOGO', ativo: true }, { canal: 'PUSH', tipo: '', ativo: true }, { canal: 'PUSH', tipo: 'INSCRICAO' }] })
assert.deepEqual(prefs, [{ canal: 'EMAIL', tipo: 'JOGO', ativo: false }, { canal: 'PUSH', tipo: 'INSCRICAO', ativo: true }])
assert.deepEqual(normalizarPreferencias(undefined), [])
assert.equal(valorDaPreferencia(prefs, 'EMAIL', 'JOGO'), false)
assert.equal(valorDaPreferencia(prefs, 'WHATSAPP', 'JOGO'), true)
const nova = comPreferencia(prefs, { canal: 'EMAIL', tipo: 'JOGO', ativo: true })
assert.equal(nova.length, 2)
assert.equal(valorDaPreferencia(nova, 'EMAIL', 'JOGO'), true)
assert.equal(tiposDisponiveis([]).length >= 1, true)
assert.deepEqual(tiposDisponiveis(prefs).map((t) => t.tipo), ['JOGO', 'INSCRICAO'])
assert.equal(tiposDisponiveis([{ canal: 'PUSH', tipo: 'NOVO_TIPO', ativo: true }])[0].rotulo, 'Novo tipo')

// cliente
async function cliente() {
  const chamadas: { url: string; init?: RequestInit }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    if (url === '/api/notificacoes/push/chave') return new Response(JSON.stringify({ data: { chavePublica: chave } }), { status: 200 })
    if (url === '/api/notificacoes/preferencias' && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify({ data: prefs }), { status: 200 })
    return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 })
  }) as unknown as typeof fetch
  const api = criarClienteCanais(f)
  assert.equal(await api.obterChavePublica(), chave)
  assert.equal((await api.listarPreferencias()).length, 2)
  await api.salvarPreferencia({ canal: 'PUSH', tipo: 'JOGO', ativo: false })
  assert.equal(chamadas[2].init?.method, 'PUT')
  assert.deepEqual(JSON.parse(String(chamadas[2].init?.body)), { canal: 'PUSH', tipo: 'JOGO', ativo: false })
  await api.assinar({ endpoint: 'https://x', chaves: { p256dh: 'P', auth: 'A' } })
  assert.equal(chamadas[3].url, '/api/notificacoes/push/assinar')
  assert.equal(chamadas[3].init?.method, 'POST')
  await api.cancelarAssinatura('https://x')
  assert.equal(chamadas[4].init?.method, 'DELETE')
  const fora = criarClienteCanais((async () => new Response(JSON.stringify({ error: 'Não encontrado.' }), { status: 404 })) as unknown as typeof fetch)
  await assert.rejects(fora.listarPreferencias(), (e: unknown) => (e as { falha?: { tipo?: string } }).falha?.tipo === 'nao-habilitado')
}

cliente().then(
  () => console.log('notificacoes-canais-ui: ok'),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
