import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

process.env.JWT_SECRET = 'segredo-de-teste-meu-time-com-32-caracteres'

const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module
const banco = instalarSupabaseFalso(require.resolve('../src/lib/supabase-admin'))

const CAT = '11111111-1111-4111-8111-111111111111'
const CAT_MASC = '22222222-2222-4222-8222-222222222222'
const CAT_FECHADA = '33333333-3333-4333-8333-333333333333'

function tabelasBase(): Record<string, LinhaEscrita[]> {
  return {
    Clube: [], TimeClube: [], MembroEquipe: [], Atleta: [], VinculoAtletaClube: [],
    Inscricao: [], InscricaoAtleta: [], InscricaoComissao: [], RegraElenco: [],
    CategoriaConfiguracao: [
      { ligaId: 1, categoriaCampeonatoId: CAT, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null },
      { ligaId: 1, categoriaCampeonatoId: CAT_MASC, genero: 'MASCULINO', idadeMinima: null, idadeMaxima: null },
    ],
    CategoriaCampeonato: [
      { id: CAT, ligaId: 1, tokenInscricao: 'token-ok', removidaEm: null },
      { id: CAT_MASC, ligaId: 1, tokenInscricao: null, removidaEm: null },
      { id: CAT_FECHADA, ligaId: 2, tokenInscricao: null, removidaEm: null },
    ],
    Liga: [
      { id: 1, status: 'ATIVA', inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null },
      { id: 2, status: 'ATIVA', inscricoesAbertas: false, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null },
    ],
    CandidaturaEquipe: [{ id: 'user-tecnico', email: 'tec@volei.space', responsavel: 'Téo Técnico', nome: 'Equipe T' }],
    ContaPublico: [],
  }
}

function req(metodo: string, caminho: string, corpo?: unknown) {
  return new NextRequest(`http://127.0.0.1:3001${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
}

async function json(resposta: Response) {
  return (await resposta.json()) as any
}

async function main() {
  const { signPublicToken } = await import('../src/lib/auth')
  const entrar = async (userId: string) => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo: 'equipe', status: 'ATIVA', trocarSenha: false })
  }
  const lista = await import('../src/app/api/meu-time/route')
  const equipes = await import('../src/app/api/meu-time/equipes/route')
  const detalhe = await import('../src/app/api/meu-time/equipes/[id]/route')
  const atletasRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/route')
  const loteRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/lote/route')
  const atletaRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/route')
  const comissaoRota = await import('../src/app/api/meu-time/equipes/[id]/comissao/route')
  const inscricoesRota = await import('../src/app/api/meu-time/equipes/[id]/inscricoes/route')
  const prontidaoRota = await import('../src/app/api/meu-time/equipes/[id]/prontidao/route')

  // --- Flag desligada: 404, mesmo logado ---------------------------------------
  delete process.env.MEU_TIME_ATIVO
  banco.atual = criarBancoEscrita(tabelasBase())
  await entrar('user-a')
  assert.equal((await lista.GET(req('GET', '/api/meu-time'))).status, 404)
  assert.equal((await equipes.POST(req('POST', '/api/meu-time/equipes', {}))).status, 404)

  // --- Flag ligada: sessão obrigatória, tipo equipe ----------------------------
  process.env.MEU_TIME_ATIVO = '1'
  sessao.token = null
  assert.equal((await lista.GET(req('GET', '/api/meu-time'))).status, 401)
  sessao.token = await signPublicToken({ userId: 'arb', email: 'a@v.space', nome: 'Arb', tipo: 'arbitro', status: 'ATIVA', trocarSenha: false })
  assert.equal((await lista.GET(req('GET', '/api/meu-time'))).status, 401, 'só conta de equipe acessa o Meu Time')

  // --- Migrations pendentes: tabela inexistente = 503 --------------------------
  banco.atual = criarBancoEscrita({})
  await entrar('user-a')
  for (const resposta of [await lista.GET(req('GET', '/api/meu-time')), await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: 'Time', naipe: 'FEMININO' }))]) {
    assert.equal(resposta.status, 503)
    assert.deepEqual(await json(resposta), { error: 'Meu Time ainda não está habilitado neste ambiente.' })
  }

  // --- Equipe: criar, listar, isolamento ---------------------------------------
  const tabelas = tabelasBase()
  banco.atual = criarBancoEscrita(tabelas, { unicos: { Inscricao: [['categoriaCampeonatoId', 'timeId']], MembroEquipe: [['timeId', 'usuarioId']] }, padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, capitao: false, libero: false } } })
  await entrar('user-a')
  assert.equal((await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: '', naipe: 'FEMININO' }))).status, 422)
  assert.equal((await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: 'Time', naipe: 'OUTRO' }))).status, 422)
  const criada = await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: 'Vôlei Norte', cidade: 'Belém', naipe: 'FEMININO' }))
  assert.equal(criada.status, 201)
  const equipe = (await json(criada)).data
  assert.deepEqual(Object.keys(equipe).sort(), ['cidade', 'id', 'naipe', 'nome', 'prontidao', 'totalAtletas'])
  assert.equal(equipe.totalAtletas, 0)
  assert.equal(tabelas.MembroEquipe[0].papel, 'RESPONSAVEL')
  assert.equal(tabelas.Clube.length, 1)

  const segunda = await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: 'Vôlei Norte Sub-17', naipe: 'FEMININO' }))
  assert.equal(segunda.status, 201)
  assert.equal(tabelas.Clube.length, 1, 'o clube do usuário é reaproveitado')
  assert.equal((await json(await lista.GET(req('GET', '/api/meu-time')))).data.equipes.length, 2)

  const idEquipe = equipe.id as string
  const params = { params: { id: idEquipe } }
  await entrar('user-b')
  assert.equal((await json(await lista.GET(req('GET', '/api/meu-time')))).data.equipes.length, 0)
  assert.equal((await detalhe.GET(req('GET', `/api/meu-time/equipes/${idEquipe}`), params)).status, 404, 'outro usuário não enxerga a equipe')
  assert.equal((await atletasRota.POST(req('POST', '/x', { nome: 'Intruso', dataNascimento: '2000-01-01' }), params)).status, 404)
  assert.equal((await inscricoesRota.POST(req('POST', '/x', {}), params)).status, 404)
  assert.equal((await detalhe.GET(req('GET', '/x'), { params: { id: 'nao-e-uuid' } })).status, 404)

  // --- Atletas -----------------------------------------------------------------
  await entrar('user-a')
  const nomes = ['Ana', 'Bia', 'Carla', 'Dani', 'Eva', 'Fabi']
  const atletas: any[] = []
  for (let i = 0; i < nomes.length; i += 1) {
    const nome = nomes[i]
    const r = await atletasRota.POST(req('POST', '/x', { nome: `${nome} Silva`, dataNascimento: `200${i}-03-1${i}`, posicao: 'OP' }), params)
    assert.equal(r.status, 201, nome)
    atletas.push((await json(r)).data)
  }
  assert.deepEqual(Object.keys(atletas[0]).sort(), ['dataNascimento', 'id', 'nome', 'numeroPreferido', 'posicao', 'temDocumento'])
  assert.equal((await atletasRota.POST(req('POST', '/x', { nome: 'ana  SILVA', dataNascimento: '2000-03-10' }), params)).status, 409)
  assert.equal((await atletasRota.POST(req('POST', '/x', { nome: 'Sem Data' }), params)).status, 422)
  assert.equal((await atletasRota.POST(req('POST', '/x', { nome: 'Futura', dataNascimento: '2999-01-01' }), params)).status, 422)

  // Documento existe no banco: o detalhe só diz temDocumento, nunca o valor.
  const linhaAna = tabelas.Atleta.find((a) => a.id === atletas[0].id)!
  Object.assign(linhaAna, { cpfHash: 'hash-secreto', sexo: 'F' })
  tabelas.AtletaDocumento = [{ atletaId: linhaAna.id, cpfCifrado: 'cifrado', telefoneCifrado: 'tel' }]
  const detalheResposta = await detalhe.GET(req('GET', '/x'), params)
  const corpo = await json(detalheResposta)
  assert.equal(corpo.data.atletas.length, 6)
  assert.equal(corpo.data.atletas.find((a: any) => a.id === atletas[0].id).temDocumento, true)
  assert.equal(corpo.data.prontidao.mensagem, 'Seu time tem 6 atletas. 5 estão sem documento.')
  assert.equal(corpo.data.equipe.id, idEquipe)
  const bruto = JSON.stringify(corpo)
  for (const proibido of ['hash-secreto', 'cifrado', 'cpf', 'telefone', 'clubeId']) assert.ok(!bruto.includes(proibido), `vazou ${proibido}`)
  assert.equal((await json(await prontidaoRota.GET(req('GET', '/x'), params))).data.semDocumento, 5)

  // PATCH e DELETE.
  const patch = await atletaRota.PATCH(req('PATCH', '/x', { nome: 'Ana Souza' }), { params: { id: idEquipe, atletaId: atletas[0].id } })
  assert.equal(patch.status, 200)
  assert.equal((await json(patch)).data.nome, 'Ana Souza')
  assert.equal((await atletaRota.PATCH(req('PATCH', '/x', {}), { params: { id: idEquipe, atletaId: atletas[0].id } })).status, 422)
  assert.equal((await atletaRota.PATCH(req('PATCH', '/x', { nome: 'Bia Silva', dataNascimento: atletas[1].dataNascimento }), { params: { id: idEquipe, atletaId: atletas[0].id } })).status, 409)
  const extra = await json(await atletasRota.POST(req('POST', '/x', { nome: 'Gabi Removida', dataNascimento: '1999-09-09' }), params))
  const del = await atletaRota.DELETE(req('DELETE', '/x'), { params: { id: idEquipe, atletaId: extra.data.id } })
  assert.equal(del.status, 200)
  assert.equal((await json(await detalhe.GET(req('GET', '/x'), params))).data.atletas.length, 6)
  assert.equal(tabelas.Atleta.some((a) => a.id === extra.data.id), true, 'o cadastro do atleta permanece')
  assert.equal((await atletaRota.DELETE(req('DELETE', '/x'), { params: { id: idEquipe, atletaId: extra.data.id } })).status, 404)

  // Lote.
  const lote = await loteRota.POST(req('POST', '/x', { atletas: [{ nome: 'Hana Lima', numero: 9 }, { nome: 'ana souza' }, { nome: '?', numero: 1 }, { nome: 'Iris Melo', numero: 120 }] }), params)
  assert.equal(lote.status, 200)
  const dadosLote = (await json(lote)).data
  assert.deepEqual(dadosLote.criados.map((a: any) => a.nome), ['Hana Lima'])
  assert.deepEqual(dadosLote.ignorados.map((i: any) => i.linha), [2, 3, 4])
  assert.equal((await loteRota.POST(req('POST', '/x', {}), params)).status, 422)
  const colado = await json(await loteRota.POST(req('POST', '/x', { texto: 'Jade Melo, 4\n5 - Kika Reis' }), params))
  assert.equal(colado.data.criados.length, 2)

  // --- Comissão ----------------------------------------------------------------
  assert.equal((await comissaoRota.POST(req('POST', '/x', { email: 'ninguem@volei.space', papel: 'TECNICO' }), params)).status, 404)
  assert.equal((await comissaoRota.POST(req('POST', '/x', { email: 'tec@volei.space', papel: 'RESPONSAVEL' }), params)).status, 422)
  const membro = await comissaoRota.POST(req('POST', '/x', { email: 'tec@volei.space', papel: 'TECNICO' }), params)
  assert.equal(membro.status, 201)
  assert.deepEqual((await json(membro)).data, { id: 'user-tecnico', nome: 'Téo Técnico', papel: 'TECNICO' })
  assert.equal((await comissaoRota.POST(req('POST', '/x', { email: 'tec@volei.space', papel: 'TECNICO' }), params)).status, 409, 'membro duplicado')
  const comissaoLista = (await json(await comissaoRota.GET(req('GET', '/x'), params))).data
  assert.equal(comissaoLista.length, 2)
  assert.ok(!JSON.stringify(comissaoLista).includes('@'), 'comissão não expõe e-mail')
  assert.equal((await comissaoRota.DELETE(req('DELETE', '/x?membroId=user-a'), params)).status, 409, 'responsável não sai')
  assert.equal((await comissaoRota.DELETE(req('DELETE', '/x'), params)).status, 400)

  // O técnico lê e edita atletas, mas não gerencia a comissão.
  await entrar('user-tecnico')
  assert.equal((await detalhe.GET(req('GET', '/x'), params)).status, 200)
  assert.equal((await atletasRota.POST(req('POST', '/x', { nome: 'Lia Nunes', dataNascimento: '2001-01-01' }), params)).status, 201)
  assert.equal((await comissaoRota.POST(req('POST', '/x', { email: 'tec@volei.space', papel: 'ASSISTENTE' }), params)).status, 403)

  // --- Inscrição ---------------------------------------------------------------
  await entrar('user-a')
  const todos = (await json(await detalhe.GET(req('GET', '/x'), params))).data.atletas as any[]
  const seis = todos.slice(0, 6)
  const selecao = seis.map((a, i) => ({ atletaId: a.id, numero: i + 1, capitao: i === 0, libero: i === 5 }))
  const pedido = (extras: Record<string, unknown> = {}) => req('POST', '/x', { categoriaCampeonatoId: CAT, atletas: selecao, ...extras })

  assert.equal((await inscricoesRota.POST(req('POST', '/x', { categoriaCampeonatoId: CAT, atletas: [] }), params)).status, 422)
  assert.equal((await inscricoesRota.POST(pedido({ categoriaCampeonatoId: '44444444-4444-4444-8444-444444444444' }), params)).status, 404)
  assert.equal((await inscricoesRota.POST(pedido({ convite: 'outro' }), params)).status, 403)
  assert.equal((await inscricoesRota.POST(pedido({ categoriaCampeonatoId: CAT_FECHADA }), params)).status, 403, 'inscrições fechadas')
  const masculina = await inscricoesRota.POST(pedido({ categoriaCampeonatoId: CAT_MASC }), params)
  assert.equal(masculina.status, 422)
  assert.equal((await json(masculina)).codigo, 'NAIPE_INCOMPATIVEL')

  const repetido = await inscricoesRota.POST(req('POST', '/x', { categoriaCampeonatoId: CAT, atletas: [{ atletaId: seis[0].id, numero: 5 }, { atletaId: seis[1].id, numero: 5 }] }), params)
  assert.equal(repetido.status, 422)
  assert.equal((await json(repetido)).codigo, 'NUMERO_REPETIDO')
  assert.equal(tabelas.Inscricao.length, 0, 'nada é gravado quando a regra reprova')

  tabelas.RegraElenco.push({ categoriaCampeonatoId: CAT, ligaId: 1, atletasMin: 7, atletasMax: 14, liberosMax: 1, documentosExigidos: ['CPF'], comissaoMax: 1 })
  const poucos = await json(await inscricoesRota.POST(pedido(), params))
  assert.equal(poucos.codigo, 'ABAIXO_DO_MINIMO')
  tabelas.RegraElenco[0].atletasMin = 6

  const ok = await inscricoesRota.POST(pedido({ convite: 'token-ok', comissao: ['user-tecnico'] }), params)
  assert.equal(ok.status, 201)
  const inscrita = await json(ok)
  assert.deepEqual(Object.keys(inscrita.data).sort(), ['categoriaCampeonatoId', 'id', 'status', 'totalAtletas'])
  assert.equal(inscrita.data.status, 'CONFIRMADA_COM_PENDENCIAS', 'cinco sem documento')
  assert.equal(inscrita.data.totalAtletas, 6)
  assert.ok(inscrita.avisos.some((a: string) => /falta o documento/.test(a)))
  // Cópia: snapshot gravado, com o nome e o número do momento.
  assert.equal(tabelas.InscricaoAtleta.length, 6)
  assert.equal(tabelas.InscricaoAtleta[0].nomeSnapshot, seis[0].nome)
  assert.equal(tabelas.InscricaoAtleta.filter((l) => l.capitao).length, 1)
  assert.equal(tabelas.InscricaoComissao[0].nomeSnapshot, 'Téo Técnico')
  Object.assign(tabelas.Atleta.find((a) => a.id === seis[1].id)!, { nome: 'Nome Alterado Depois' })
  assert.equal(tabelas.InscricaoAtleta.find((l) => l.atletaId === seis[1].id)!.nomeSnapshot, seis[1].nome, 'mudar o banco não altera a inscrição')

  assert.equal((await inscricoesRota.POST(pedido(), params)).status, 409, 'mesma equipe, mesma categoria')
  const detalheFinal = (await json(await detalhe.GET(req('GET', '/x'), params))).data
  assert.deepEqual(detalheFinal.inscricoes, [{ id: inscrita.data.id, categoriaCampeonatoId: CAT, status: 'CONFIRMADA_COM_PENDENCIAS', totalAtletas: 6 }])

  // Atleta em um só time por categoria: outra equipe tenta usar atleta já inscrito.
  await entrar('user-c')
  const outra = await json(await equipes.POST(req('POST', '/api/meu-time/equipes', { nome: 'Rival', naipe: 'FEMININO' })))
  const clubeRival = tabelas.TimeClube.find((t) => t.id === outra.data.id)!.clubeId
  tabelas.VinculoAtletaClube.push({ clubeId: clubeRival, atletaId: seis[0].id, status: 'ATIVO' })
  const rival = await inscricoesRota.POST(req('POST', '/x', { categoriaCampeonatoId: CAT, atletas: [{ atletaId: seis[0].id, numero: 1 }] }), { params: { id: outra.data.id } })
  assert.equal(rival.status, 422)
  assert.equal((await json(rival)).codigo, 'ATLETA_EM_OUTRO_TIME')

  // Comissão de fora da equipe não entra na inscrição (a equipe "Vôlei Norte Sub-17" ainda está livre na CAT).
  await entrar('user-a')
  const subs = tabelas.TimeClube.find((t) => t.nome === 'Vôlei Norte Sub-17')!
  const naoMembro = await inscricoesRota.POST(req('POST', '/x', { categoriaCampeonatoId: CAT, atletas: [{ atletaId: todos[6].id, numero: 1 }], comissao: ['estranho'] }), { params: { id: subs.id } })
  assert.equal(naoMembro.status, 422)
  assert.equal((await json(naoMembro)).codigo, 'MEMBRO_FORA_DA_EQUIPE')

  console.log('meu-time-rotas: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
