import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-meu-time-com-32-caracteres'
process.env.LGPD_CHAVE_CIFRA = Buffer.alloc(32, 7).toString('base64')

const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const EQ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EQ_ALHEIA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const EQ_ASSIST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CLUBE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CLUBE_ALHEIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const NOTIF_ALHEIA = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

function tabelas(extra: Record<string, LinhaEscrita[] | undefined> = {}): Record<string, LinhaEscrita[]> {
  const base: Record<string, LinhaEscrita[]> = {
    Clube: [
      { id: CLUBE, nome: 'Clube A', cidade: null, criadoPor: 'lider', arquivadoEm: null },
      { id: CLUBE_ALHEIO, nome: 'Clube B', cidade: null, criadoPor: 'outro', arquivadoEm: null },
    ],
    TimeClube: [
      { id: EQ, clubeId: CLUBE, nome: 'Equipe A', cidade: null, naipe: 'FEMININO', escudoUrl: null, arquivadoEm: null },
      { id: EQ_ALHEIA, clubeId: CLUBE_ALHEIO, nome: 'Equipe B', cidade: null, naipe: 'MASCULINO', escudoUrl: null, arquivadoEm: null },
      { id: EQ_ASSIST, clubeId: CLUBE_ALHEIO, nome: 'Equipe C', cidade: null, naipe: 'MISTO', escudoUrl: null, arquivadoEm: null },
    ],
    MembroEquipe: [
      { timeId: EQ, usuarioId: 'lider', papel: 'RESPONSAVEL' },
      { timeId: EQ, usuarioId: 'assist', papel: 'ASSISTENTE' },
      { timeId: EQ_ALHEIA, usuarioId: 'outro', papel: 'RESPONSAVEL' },
      { timeId: EQ_ASSIST, usuarioId: 'lider', papel: 'TECNICO' },
    ],
    Atleta: [], VinculoAtletaClube: [], AtletaConsentimento: [],
    ConviteAtleta: [], ImportacaoAtletas: [], Notificacao: [],
    CandidaturaEquipe: [], ContaPublico: [],
  }
  return { ...base, ...(extra as Record<string, LinhaEscrita[]>) }
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
  const entrar = async (userId: string) => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo: 'equipe', status: 'ATIVA', trocarSenha: false })
  }
  const convites = await import('../src/app/api/meu-time/convites/route')
  const convite = await import('../src/app/api/meu-time/convites/[id]/route')
  const publico = await import('../src/app/api/convite-atleta/[token]/route')
  const importacao = await import('../src/app/api/meu-time/importacao/route')
  const importacaoId = await import('../src/app/api/meu-time/importacao/[id]/route')
  const confirmar = await import('../src/app/api/meu-time/importacao/[id]/confirmar/route')
  const clube = await import('../src/app/api/meu-time/clube/route')
  const clubeEquipes = await import('../src/app/api/meu-time/clube/equipes/route')
  const notifs = await import('../src/app/api/meu-time/notificacoes/route')
  const lida = await import('../src/app/api/meu-time/notificacoes/[id]/lida/route')
  const { notificar } = await import('../src/lib/meu-time-fase2/notificacoes')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')

  // --- Flags -------------------------------------------------------------------
  banco.atual = criarBancoEscrita(tabelas())
  await entrar('lider')
  process.env.MEU_TIME_ATIVO = '1'
  delete process.env.MEU_TIME_FASE2_ATIVO
  assert.equal((await convites.GET(req('GET', `/api/meu-time/convites?equipeId=${EQ}`))).status, 404)
  assert.equal((await publico.GET(req('GET', '/x'), { params: { token: 'a' } })).status, 404)
  process.env.MEU_TIME_FASE2_ATIVO = '1'
  delete process.env.MEU_TIME_ATIVO
  assert.equal((await clube.GET(req('GET', '/api/meu-time/clube'))).status, 404)
  process.env.MEU_TIME_ATIVO = '1'

  // --- Convites ----------------------------------------------------------------
  sessao.token = null
  assert.equal((await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ }))).status, 401)
  await entrar('assist')
  assert.equal((await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ }))).status, 403, 'assistente não gera')
  await entrar('outro')
  assert.equal((await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ }))).status, 404, 'equipe alheia')
  await entrar('lider')
  assert.equal((await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: 'x' }))).status, 422)

  let r = await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ, contato: '11988887777' }))
  assert.equal(r.status, 201)
  let corpo = await json(r)
  assert.match(corpo.data.url, /\/convite-atleta\/[A-Za-z0-9_-]{43}$/)
  const token = corpo.data.url.split('/').pop() as string
  const expira = new Date(corpo.data.expiraEm).getTime() - Date.now()
  assert.ok(expira > 13.9 * 86400000 && expira < 14.1 * 86400000)
  const linhaConvite = banco.atual ? (await (banco.atual as any).from('ConviteAtleta').select()).data[0] : null
  assert.ok(linhaConvite.tokenHash && !JSON.stringify(linhaConvite).includes(token), 'só o hash fica no banco')
  assert.ok(String(linhaConvite.contatoCifrado).startsWith('\\x') && !String(linhaConvite.contatoCifrado).includes('11988887777'))

  r = await convites.GET(req('GET', `/api/meu-time/convites?equipeId=${EQ}`))
  corpo = await json(r)
  assert.equal(corpo.data.length, 1)
  assert.equal(corpo.data[0].estado, 'ATIVO')
  assert.ok(!JSON.stringify(corpo).includes(token) && !('tokenHash' in corpo.data[0]) && !('contatoCifrado' in corpo.data[0]))
  assert.equal((await convites.GET(req('GET', '/api/meu-time/convites'))).status, 400)
  await entrar('outro')
  assert.equal((await convites.GET(req('GET', `/api/meu-time/convites?equipeId=${EQ}`))).status, 404)
  await entrar('lider')

  // Público: GET sem PII
  r = await publico.GET(req('GET', '/x'), { params: { token } })
  corpo = await json(r)
  assert.deepEqual(corpo.data, { estado: 'DISPONIVEL', equipe: { nome: 'Equipe A', naipe: 'FEMININO' } })
  assert.deepEqual((await json(await publico.GET(req('GET', '/x'), { params: { token: 'lixo' } }))).data, { estado: 'INDISPONIVEL' })

  // POST: validação, aceite único, maior de idade
  sessao.token = null
  assert.equal((await publico.POST(req('POST', '/x', { nome: 'A', dataNascimento: '2000-01-01' }), { params: { token } })).status, 422)
  r = await publico.POST(req('POST', '/x', { nome: 'Carla Atleta', dataNascimento: '2000-05-05', camisa: 12, posicao: 'PT' }), { params: { token } })
  assert.equal(r.status, 201)
  corpo = await json(r)
  assert.equal(corpo.data.recebido, true)
  assert.deepEqual(corpo.data.pendencias, [])
  const atletas = (await (banco.atual as any).from('Atleta').select()).data
  assert.equal(atletas.length, 1)
  assert.equal(atletas[0].numeroPreferido, 12)
  assert.equal((await (banco.atual as any).from('VinculoAtletaClube').select()).data[0].clubeId, CLUBE)
  const notif = (await (banco.atual as any).from('Notificacao').select()).data
  assert.equal(notif.length, 1)
  assert.equal(notif[0].usuarioId, 'lider')
  // segundo uso: indisponível, igual a token inventado
  const usado = await publico.POST(req('POST', '/x', { nome: 'Outra Pessoa', dataNascimento: '2001-05-05' }), { params: { token } })
  assert.equal(usado.status, 404)
  assert.equal((await json(usado)).codigo, 'CONVITE_INDISPONIVEL')
  assert.equal((await publico.POST(req('POST', '/x', { nome: 'Outra Pessoa', dataNascimento: '2001-05-05' }), { params: { token: 'z'.repeat(43) } })).status, 404)
  assert.deepEqual((await json(await publico.GET(req('GET', '/x'), { params: { token } }))).data, { estado: 'INDISPONIVEL' })
  assert.equal((await (banco.atual as any).from('Atleta').select()).data.length, 1)

  // Menor: cria com a pendência de consentimento; duplicata responde igual e não duplica
  await entrar('lider')
  const novo = async () => (await json(await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ })))).data.url.split('/').pop() as string
  sessao.token = null
  const t2 = await novo().catch(() => '')
  assert.equal(t2, '', 'sem sessão não gera')
  await entrar('lider')
  const t3 = await novo()
  sessao.token = null
  r = await publico.POST(req('POST', '/x', { nome: 'Menina Menor', dataNascimento: '2015-01-01' }), { params: { token: t3 } })
  assert.equal(r.status, 201)
  assert.deepEqual((await json(r)).data.pendencias, ['ATLETA_MENOR_SEM_CONSENTIMENTO'])
  await entrar('lider')
  const t4 = await novo()
  sessao.token = null
  r = await publico.POST(req('POST', '/x', { nome: 'carla atleta', dataNascimento: '2000-05-05' }), { params: { token: t4 } })
  assert.equal(r.status, 201)
  assert.equal((await (banco.atual as any).from('Atleta').select()).data.length, 2, 'duplicata não cria')

  // Revogar
  await entrar('lider')
  const t5 = await novo()
  const lista = (await json(await convites.GET(req('GET', `/api/meu-time/convites?equipeId=${EQ}`)))).data
  const ativo = lista.find((c: any) => c.estado === 'ATIVO')
  await entrar('outro')
  assert.equal((await convite.DELETE(req('DELETE', '/x'), { params: { id: ativo.id } })).status, 404)
  await entrar('assist')
  assert.equal((await convite.DELETE(req('DELETE', '/x'), { params: { id: ativo.id } })).status, 403)
  await entrar('lider')
  assert.equal((await convite.DELETE(req('DELETE', '/x'), { params: { id: ativo.id } })).status, 200)
  assert.equal((await convite.DELETE(req('DELETE', '/x'), { params: { id: ativo.id } })).status, 200, 'idempotente')
  assert.equal((await convite.DELETE(req('DELETE', '/x'), { params: { id: 'nao-uuid' } })).status, 404)
  sessao.token = null
  assert.equal((await publico.POST(req('POST', '/x', { nome: 'Depois Revogado', dataNascimento: '2001-05-05' }), { params: { token: t5 } })).status, 404)

  // Expirado
  const expirada = (banco.atual as any)
  await entrar('lider')
  const t6 = await novo()
  const linhas = (await expirada.from('ConviteAtleta').select()).data
  await expirada.from('ConviteAtleta').update({ expiraEm: new Date(Date.now() - 1000).toISOString() }).eq('id', linhas[linhas.length - 1].id)
  assert.deepEqual((await json(await publico.GET(req('GET', '/x'), { params: { token: t6 } }))).data, { estado: 'INDISPONIVEL' })

  // Limite de taxa no GET público
  reiniciarCotas()
  let ultimo = 200
  for (let i = 0; i < 61; i += 1) ultimo = (await publico.GET(req('GET', '/x'), { params: { token } })).status
  assert.equal(ultimo, 429)
  reiniciarCotas()

  // Tabela ausente: 503
  const semTabela = tabelas()
  delete (semTabela as any).ConviteAtleta
  delete (semTabela as any).Notificacao
  delete (semTabela as any).ImportacaoAtletas
  banco.atual = criarBancoEscrita(semTabela)
  await entrar('lider')
  r = await convites.POST(req('POST', '/api/meu-time/convites', { equipeId: EQ }))
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal((await notifs.GET(req('GET', '/api/meu-time/notificacoes'))).status, 503)
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv: 'nome,nascimento\nAna Souza,2000-01-01' }))).status, 503)

  // --- Importação --------------------------------------------------------------
  banco.atual = criarBancoEscrita(tabelas({
    Atleta: [{ id: '11111111-1111-4111-8111-111111111111', nome: 'Bia Existente', dataNascimento: '1999-09-09' }],
    VinculoAtletaClube: [{ clubeId: CLUBE, atletaId: '11111111-1111-4111-8111-111111111111', status: 'ATIVO' }],
  }))
  await entrar('lider')
  const csv = [
    'nome;nascimento;camisa;posicao;responsavel_contato',
    'Ana Souza;15/03/1998;7;OP;',
    'Bia Existente;09/09/1999;8;;',
    'Caio Menor;01/01/2014;9;;11999990000',
    'Dani Erro;31/02/2000;;;',
    'Eva Camisa;2001-02-03;7;;',
  ].join('\n')
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ_ALHEIA, csv }))).status, 404)
  await entrar('assist')
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv }))).status, 403)
  await entrar('lider')
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv: '' }))).status, 422)
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv: 'foo,bar\n1,2' }))).status, 422)
  const grande = ['nome,nascimento', ...Array.from({ length: 61 }, (_, i) => `Atleta ${i}x,2000-01-01`)].join('\n')
  assert.equal((await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv: grande }))).status, 413)

  r = await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv }))
  assert.equal(r.status, 201)
  corpo = await json(r)
  assert.deepEqual(corpo.data.resumo, { validas: 1, comAviso: 3, invalidas: 1 })
  assert.deepEqual(corpo.data.linhas.map((l: any) => l.status), ['OK', 'AVISO', 'AVISO', 'ERRO', 'AVISO'])
  assert.ok(!JSON.stringify(corpo).includes('11999990000'))
  assert.equal((await (banco.atual as any).from('Atleta').select()).data.length, 1, 'prévia não grava atletas')
  assert.ok(!JSON.stringify((await (banco.atual as any).from('ImportacaoAtletas').select()).data).includes('11999990000'))
  const impId = corpo.data.id as string

  await entrar('outro')
  assert.equal((await confirmar.POST(req('POST', '/x'), { params: { id: impId } })).status, 404)
  assert.equal((await importacaoId.DELETE(req('DELETE', '/x'), { params: { id: impId } })).status, 404)
  await entrar('lider')
  r = await confirmar.POST(req('POST', '/x'), { params: { id: impId } })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.criados, 3)
  assert.equal(corpo.repetida, false)
  assert.equal((await (banco.atual as any).from('Atleta').select()).data.length, 4)
  assert.deepEqual(corpo.data.ignorados.map((i: any) => i.n), [2, 4])
  // idempotente
  r = await confirmar.POST(req('POST', '/x'), { params: { id: impId } })
  corpo = await json(r)
  assert.equal(r.status, 200)
  assert.equal(corpo.repetida, true)
  assert.equal(corpo.data.criados, 3)
  assert.equal((await (banco.atual as any).from('Atleta').select()).data.length, 4)
  assert.equal((await importacaoId.DELETE(req('DELETE', '/x'), { params: { id: impId } })).status, 409)
  assert.equal((await (banco.atual as any).from('Notificacao').select()).data.filter((n: any) => n.tipo === 'IMPORTACAO_CONFIRMADA').length, 1)

  // Descartar
  r = await importacao.POST(req('POST', '/api/meu-time/importacao', { equipeId: EQ, csv: 'nome,nascimento\nFulana Nova,2000-01-01' }))
  const descId = (await json(r)).data.id
  assert.equal((await importacaoId.DELETE(req('DELETE', '/x'), { params: { id: descId } })).status, 200)
  assert.equal((await confirmar.POST(req('POST', '/x'), { params: { id: descId } })).status, 404)

  // --- Clube -------------------------------------------------------------------
  banco.atual = criarBancoEscrita(tabelas())
  await entrar('novo')
  assert.equal((await clube.GET(req('GET', '/api/meu-time/clube'))).status, 404)
  assert.equal((await clube.POST(req('POST', '/api/meu-time/clube', { nome: '' }))).status, 422)
  r = await clube.POST(req('POST', '/api/meu-time/clube', { nome: 'Meu Clube' }))
  assert.equal(r.status, 201)
  r = await clube.POST(req('POST', '/api/meu-time/clube', { nome: 'Outro Nome' }))
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.nome, 'Meu Clube')
  assert.equal((await (banco.atual as any).from('Clube').select()).data.filter((c: any) => c.criadoPor === 'novo').length, 1)
  // vincular: sem liderar -> 404/403; liderando equipe de clube compartilhado -> 409
  assert.equal((await clubeEquipes.POST(req('POST', '/x', { equipeId: EQ }))).status, 404)
  await entrar('lider')
  r = await clubeEquipes.POST(req('POST', '/x', { equipeId: EQ }))
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.jaEstava, true)
  r = await clubeEquipes.POST(req('POST', '/x', { equipeId: EQ_ASSIST }))
  assert.equal(r.status, 403, 'técnico não lidera')
  assert.equal((await clube.GET(req('GET', '/api/meu-time/clube'))).status, 200)
  // equipe única de outro clube do mesmo usuário é movida com os atletas
  const tab = tabelas()
  tab.Clube.push({ id: 'c0000000-0000-4000-8000-000000000001', nome: 'Zeta Antigo', cidade: null, criadoPor: 'lider2', arquivadoEm: null })
  tab.Clube.push({ id: 'c0000000-0000-4000-8000-000000000002', nome: 'Principal', cidade: null, criadoPor: 'lider2', arquivadoEm: null })
  tab.Clube.splice(0, 2)
  tab.TimeClube = [{ id: EQ, clubeId: 'c0000000-0000-4000-8000-000000000001', nome: 'E', naipe: 'MISTO', arquivadoEm: null }]
  tab.MembroEquipe = [{ timeId: EQ, usuarioId: 'lider2', papel: 'RESPONSAVEL' }]
  tab.VinculoAtletaClube = [{ clubeId: 'c0000000-0000-4000-8000-000000000001', atletaId: 'x', status: 'ATIVO' }]
  banco.atual = criarBancoEscrita(tab)
  await entrar('lider2')
  r = await clubeEquipes.POST(req('POST', '/x', { equipeId: EQ }))
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.jaEstava, false)
  assert.equal((await (banco.atual as any).from('TimeClube').select()).data[0].clubeId, 'c0000000-0000-4000-8000-000000000002')
  assert.equal((await (banco.atual as any).from('VinculoAtletaClube').select()).data[0].clubeId, 'c0000000-0000-4000-8000-000000000002')

  // --- Notificações ------------------------------------------------------------
  banco.atual = criarBancoEscrita(tabelas({
    Notificacao: [{ id: NOTIF_ALHEIA, usuarioId: 'outro', tipo: 'AJUSTE_PEDIDO', titulo: 't', mensagem: 'm', lidaEm: null }],
  }))
  assert.equal(await notificar('lider', 'AJUSTE_PEDIDO', 'Ajuste', 'O organizador pediu ajuste.', { equipeId: EQ }), true)
  await entrar('lider')
  r = await notifs.GET(req('GET', '/api/meu-time/notificacoes'))
  corpo = await json(r)
  assert.equal(corpo.data.length, 1)
  assert.equal(corpo.naoLidas, 1)
  assert.equal(corpo.data[0].lida, false)
  assert.equal((await lida.POST(req('POST', '/x'), { params: { id: NOTIF_ALHEIA } })).status, 404, 'de outro usuário')
  assert.equal((await lida.POST(req('POST', '/x'), { params: { id: 'lixo' } })).status, 404)
  assert.equal((await lida.POST(req('POST', '/x'), { params: { id: corpo.data[0].id } })).status, 200)
  assert.equal((await lida.POST(req('POST', '/x'), { params: { id: corpo.data[0].id } })).status, 200)
  corpo = await json(await notifs.GET(req('GET', '/api/meu-time/notificacoes?naoLidas=1')))
  assert.equal(corpo.data.length, 0)
  assert.equal(corpo.naoLidas, 0)
  // notificar não lança com tabela ausente
  const semNotif = tabelas()
  delete (semNotif as any).Notificacao
  banco.atual = criarBancoEscrita(semNotif)
  assert.equal(await notificar('lider', 'AJUSTE_PEDIDO', 'x', 'y'), false)

  console.log('meu-time-fase2-rotas ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
