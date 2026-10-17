import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { instalarSupabaseFalso } from './helpers/fake-supabase'
import { criarBancoEscrita, type LinhaEscrita } from './helpers/fake-supabase-escrita'

// LGPD de menores no Meu Time (Rodada 8): consentimento do responsável, aviso na inscrição, anonimização.
// Não é parecer jurídico: testa o comportamento técnico descrito em docs/analise/25-lgpd-menores.md.

process.env.JWT_SECRET = 'segredo-de-teste-meu-time-com-32-caracteres'
process.env.MEU_TIME_ATIVO = '1'
const CHAVE = randomBytes(32).toString('base64')
process.env.LGPD_CHAVE_CIFRA = CHAVE

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
const CONTATO = '(91) 98888-7777'

function req(metodo: string, corpo?: unknown, bruto?: string) {
  return new NextRequest('http://127.0.0.1:3001/x', {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
  })
}
const json = async (resposta: Response) => (await resposta.json()) as any

function tabelasBase(): Record<string, LinhaEscrita[]> {
  return {
    Clube: [], TimeClube: [], MembroEquipe: [], Atleta: [], VinculoAtletaClube: [],
    Inscricao: [], InscricaoAtleta: [], InscricaoComissao: [], RegraElenco: [], ComissaoTime: [],
    AtletaConsentimento: [], AtletaExclusaoPedido: [], AtletaDocumento: [],
    CategoriaConfiguracao: [{ ligaId: 1, categoriaCampeonatoId: CAT, genero: 'FEMININO', idadeMinima: null, idadeMaxima: null }],
    CategoriaCampeonato: [{ id: CAT, ligaId: 1, nome: 'Adulto Feminino', tokenInscricao: 'token-ok', removidaEm: null }],
    Liga: [{ id: 1, status: 'ATIVA', inscricoesAbertas: true, inscricoesAberturaEm: null, inscricoesEncerramentoEm: null }],
    CandidaturaEquipe: [],
    ContaPublico: [],
    LinkInscricaoCampeonato: [],
  }
}

function nascimentoHaAnos(anos: number, mesDia = '06-15') {
  return `${new Date().getUTCFullYear() - anos}-${mesDia}`
}

async function main() {
  const { ehMenorDeIdade } = await import('../src/lib/lgpd/idade')
  const { cifrarContato, decifrarContato } = await import('../src/lib/lgpd/cifra')
  const { TERMO_VERSAO } = await import('../src/lib/lgpd/termo')
  const { signPublicToken } = await import('../src/lib/auth')

  // --- Idade (servidor) ------------------------------------------------------
  const ref = new Date('2026-10-17T12:00:00Z')
  assert.equal(ehMenorDeIdade('2008-10-18', ref), true, 'faz 18 amanhã')
  assert.equal(ehMenorDeIdade('2008-10-17', ref), false, 'faz 18 hoje')
  assert.equal(ehMenorDeIdade('2000-01-01', ref), false)
  assert.equal(ehMenorDeIdade('2008-02-29', new Date('2026-02-28T12:00:00Z')), true, '29/02 em ano não bissexto: maioridade em 01/03')
  assert.equal(ehMenorDeIdade('2008-02-29', new Date('2026-03-01T12:00:00Z')), false)
  assert.equal(ehMenorDeIdade(null, ref), false, 'sem nascimento a idade é desconhecida')

  // --- Cifra -----------------------------------------------------------------
  const cifrado = cifrarContato(CONTATO)
  assert.ok(cifrado.startsWith('\\x') && !cifrado.includes(CONTATO))
  assert.equal(decifrarContato(cifrado), CONTATO)
  assert.notEqual(cifrarContato(CONTATO), cifrado, 'iv aleatório')
  assert.throws(() => decifrarContato(cifrado.slice(0, -2) + (cifrado.endsWith('00') ? '01' : '00')), 'GCM detecta adulteração')

  const entrar = async (userId: string) => {
    sessao.token = await signPublicToken({ userId, email: `${userId}@volei.space`, nome: userId, tipo: 'equipe', status: 'ATIVA', trocarSenha: false })
  }
  const equipes = await import('../src/app/api/meu-time/equipes/route')
  const detalhe = await import('../src/app/api/meu-time/equipes/[id]/route')
  const atletasRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/route')
  const atletaRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/route')
  const consentRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/consentimento/route')
  const listaRota = await import('../src/app/api/meu-time/equipes/[id]/consentimentos/route')
  const prontidaoRota = await import('../src/app/api/meu-time/equipes/[id]/prontidao/route')
  const inscricoesRota = await import('../src/app/api/meu-time/equipes/[id]/inscricoes/route')

  const tabelas = tabelasBase()
  banco.atual = criarBancoEscrita(tabelas, {
    unicos: { Inscricao: [['categoriaCampeonatoId', 'timeId']], MembroEquipe: [['timeId', 'usuarioId']] },
    padroes: { InscricaoAtleta: { ativo: true, inscricaoAtiva: true, capitao: false, libero: false } },
  })
  await entrar('user-a')
  const equipe = (await json(await equipes.POST(new NextRequest('http://127.0.0.1:3001/api/meu-time/equipes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Vôlei Norte', naipe: 'FEMININO' }),
  })))).data
  const idEquipe = equipe.id as string
  const params = { params: { id: idEquipe } }
  const paramsAtleta = (atletaId: string) => ({ params: { id: idEquipe, atletaId } })
  tabelas.MembroEquipe.push({ timeId: idEquipe, usuarioId: 'user-ass', papel: 'ASSISTENTE' })
  tabelas.MembroEquipe.push({ timeId: idEquipe, usuarioId: 'user-tec', papel: 'TECNICO' })

  const responsavel = { nome: 'Rita Mãe', contato: CONTATO }

  // --- Cadastro: maior de idade ---------------------------------------------
  const adulta = await atletasRota.POST(req('POST', { nome: 'Ana Adulta', dataNascimento: nascimentoHaAnos(25) }), params)
  assert.equal(adulta.status, 201)
  const adultaDados = (await json(adulta)).data
  assert.equal(adultaDados.menor, false)
  assert.equal(adultaDados.consentimentoPendente, false)
  const rejeitada = await atletasRota.POST(req('POST', { nome: 'Outra Adulta', dataNascimento: nascimentoHaAnos(30), responsavel, aceiteResponsavel: true }), params)
  assert.equal(rejeitada.status, 422)
  assert.equal((await json(rejeitada)).codigo, 'RESPONSAVEL_DESNECESSARIO', 'minimização: não coleta responsável de maior')

  // --- Cadastro: menor sem e com responsável ---------------------------------
  const semResp = await atletasRota.POST(req('POST', { nome: 'Bia Menor', dataNascimento: nascimentoHaAnos(14) }), params)
  assert.equal(semResp.status, 201)
  const bia = (await json(semResp)).data
  assert.equal(bia.menor, true)
  assert.equal(bia.consentimentoPendente, true, 'menor entra pendente')
  assert.equal(tabelas.AtletaConsentimento.length, 0)

  for (const corpo of [
    { responsavel },
    { aceiteResponsavel: true },
    { responsavel, aceiteResponsavel: false },
    { responsavel: { nome: 'Rita', contato: '1' }, aceiteResponsavel: true },
    { responsavel: { nome: '', contato: CONTATO }, aceiteResponsavel: true },
  ]) {
    const r = await atletasRota.POST(req('POST', { nome: 'Cida Menor', dataNascimento: nascimentoHaAnos(15), ...corpo }), params)
    assert.equal(r.status, 422, JSON.stringify(corpo))
  }
  assert.equal(tabelas.Atleta.length, 2, 'cadastro inválido não grava atleta')

  const comResp = await atletasRota.POST(req('POST', { nome: 'Dani Menor', dataNascimento: nascimentoHaAnos(16), responsavel, aceiteResponsavel: true }), params)
  assert.equal(comResp.status, 201)
  const corpoDani = await comResp.text()
  assert.ok(!corpoDani.includes(CONTATO) && !corpoDani.includes('Rita'), 'a resposta não traz dados do responsável')
  const dani = JSON.parse(corpoDani).data
  assert.equal(dani.menor, true)
  assert.equal(dani.consentimentoPendente, false)
  assert.deepEqual(Object.keys(dani).sort(), ['consentimentoPendente', 'dataNascimento', 'id', 'menor', 'nome', 'numeroPreferido', 'posicao', 'temDocumento'])
  const registro = tabelas.AtletaConsentimento[0]
  assert.equal(registro.atletaId, dani.id)
  assert.equal(registro.versaoTermo, TERMO_VERSAO)
  assert.equal(registro.registradoPor, 'user-a')
  assert.equal(registro.responsavelNome, 'Rita Mãe')
  assert.ok(registro.aceitoEm && registro.revogadoEm == null)
  assert.ok(String(registro.responsavelContatoCifrado).startsWith('\\x') && !JSON.stringify(registro).includes(CONTATO), 'contato só cifrado')
  assert.equal(decifrarContato(registro.responsavelContatoCifrado), CONTATO)

  // Sem chave de cifra: recusa (fail-closed) e não deixa cadastro pela metade.
  delete process.env.LGPD_CHAVE_CIFRA
  const semChave = await atletasRota.POST(req('POST', { nome: 'Eva Menor', dataNascimento: nascimentoHaAnos(13), responsavel, aceiteResponsavel: true }), params)
  assert.equal(semChave.status, 503)
  assert.equal(tabelas.Atleta.some((a) => a.nome === 'Eva Menor'), false)
  assert.equal(tabelas.VinculoAtletaClube.length, 3)
  process.env.LGPD_CHAVE_CIFRA = CHAVE

  // --- Detalhe e prontidão -----------------------------------------------------
  const det = (await json(await detalhe.GET(req('GET'), params))).data
  assert.equal(det.atletas.find((a: any) => a.id === bia.id).consentimentoPendente, true)
  assert.equal(det.atletas.find((a: any) => a.id === dani.id).consentimentoPendente, false)
  assert.equal(det.prontidao.semAutorizacaoResponsavel, 1)
  const pront = (await json(await prontidaoRota.GET(req('GET'), params))).data
  assert.equal(pront.semAutorizacaoResponsavel, 1)
  assert.match(pront.mensagem, /1 está sem autorização do responsável/)
  assert.ok(!JSON.stringify(det).includes(CONTATO))

  // --- Lista de consentimentos --------------------------------------------------
  const lista = await listaRota.GET(req('GET'), params)
  assert.equal(lista.status, 200)
  const textoLista = await lista.text()
  assert.ok(!textoLista.includes(CONTATO) && !/Cifrado|contato/i.test(textoLista), 'a lista nunca expõe contato')
  const dadosLista = JSON.parse(textoLista).data
  assert.equal(dadosLista.totalMenores, 2)
  assert.equal(dadosLista.pendentes, 1)
  assert.equal(dadosLista.atletas.find((a: any) => a.atletaId === bia.id).estado, 'PENDENTE')
  assert.equal(dadosLista.atletas.find((a: any) => a.atletaId === dani.id).estado, 'REGISTRADO')
  assert.equal(dadosLista.termo.versao, TERMO_VERSAO)

  // Permissões: só RESPONSAVEL e TECNICO; não-membro nem enxerga a equipe.
  await entrar('user-ass')
  assert.equal((await listaRota.GET(req('GET'), params)).status, 403)
  assert.equal((await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta(bia.id))).status, 403)
  await entrar('user-b')
  assert.equal((await listaRota.GET(req('GET'), params)).status, 404)
  assert.equal((await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta(bia.id))).status, 404)
  assert.equal(tabelas.AtletaConsentimento.length, 1)

  // --- Completar depois, renovar e revogar -----------------------------------------
  await entrar('user-tec')
  assert.equal((await listaRota.GET(req('GET'), params)).status, 200, 'técnico lê')
  assert.equal((await consentRota.POST(req('POST', { responsavel }), paramsAtleta(bia.id))).status, 422, 'aceite obrigatório')
  assert.equal((await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta(adultaDados.id))).status, 422)
  assert.equal((await json(await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta(adultaDados.id)))).codigo, 'ATLETA_MAIOR_DE_IDADE')
  assert.equal((await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta('nao-uuid'))).status, 404)
  const completa = await consentRota.POST(req('POST', { responsavel: { nome: 'Paulo Pai', contato: 'paulo@exemplo.com' }, aceiteResponsavel: true }), paramsAtleta(bia.id))
  assert.equal(completa.status, 201)
  const textoCompleta = await completa.text()
  assert.ok(!textoCompleta.includes('paulo@exemplo.com'))
  assert.equal(JSON.parse(textoCompleta).data.estado, 'REGISTRADO')
  const daBia = tabelas.AtletaConsentimento.filter((c) => c.atletaId === bia.id)
  assert.equal(daBia.length, 1)
  assert.equal(daBia[0].registradoPor, 'user-tec', 'registra quem completou')
  // Renovar: o anterior é revogado, só um fica ativo.
  assert.equal((await consentRota.POST(req('POST', { responsavel, aceiteResponsavel: true }), paramsAtleta(bia.id))).status, 201)
  const historico = tabelas.AtletaConsentimento.filter((c) => c.atletaId === bia.id)
  assert.equal(historico.length, 2)
  assert.equal(historico.filter((c) => c.revogadoEm == null).length, 1)
  // Revogar volta a pendente.
  const revogado = await json(await consentRota.DELETE(req('DELETE'), paramsAtleta(bia.id)))
  assert.equal(revogado.data.estado, 'PENDENTE')
  assert.equal(tabelas.AtletaConsentimento.filter((c) => c.atletaId === bia.id && c.revogadoEm == null).length, 0)

  // --- PATCH: menor com responsável; data de nascimento que vira maior --------------
  await entrar('user-a')
  const patch = await atletaRota.PATCH(req('PATCH', { responsavel, aceiteResponsavel: true }), paramsAtleta(bia.id))
  assert.equal(patch.status, 200)
  assert.equal((await json(patch)).data.consentimentoPendente, false)
  assert.equal((await atletaRota.PATCH(req('PATCH', { responsavel }), paramsAtleta(bia.id))).status, 422)
  assert.equal((await atletaRota.PATCH(req('PATCH', { responsavel, aceiteResponsavel: true }), paramsAtleta(adultaDados.id))).status, 422)
  await consentRota.DELETE(req('DELETE'), paramsAtleta(bia.id))

  // --- Inscrição não bloqueia, avisa e marca pendência ---------------------------------
  const inscrever = (atletas: Array<{ atletaId: string; numero: number }>) =>
    inscricoesRota.POST(req('POST', { categoriaCampeonatoId: CAT, convite: 'token-ok', atletas }), params)
  const insc = await inscrever([
    { atletaId: adultaDados.id, numero: 1 },
    { atletaId: bia.id, numero: 2 },
    { atletaId: dani.id, numero: 3 },
  ])
  assert.equal(insc.status, 201)
  const corpoInsc = await json(insc)
  assert.equal(corpoInsc.data.status, 'CONFIRMADA_COM_PENDENCIAS')
  const avisosLgpd = corpoInsc.avisos.filter((a: string) => a.startsWith('ATLETA_MENOR_SEM_CONSENTIMENTO'))
  assert.equal(avisosLgpd.length, 1, 'só a Bia está sem autorização')
  assert.match(avisosLgpd[0], /Bia Menor/)
  assert.deepEqual(corpoInsc.avisosDetalhe.map((a: any) => [a.codigo, a.atletaId]), [['ATLETA_MENOR_SEM_CONSENTIMENTO', bia.id]])
  assert.equal(tabelas.InscricaoAtleta.length, 3, 'a inscrição foi gravada mesmo assim')
  assert.ok(!JSON.stringify(corpoInsc).includes(CONTATO))

  // Com tudo autorizado e só adultos: sem aviso de LGPD.
  tabelas.Inscricao.length = 0
  tabelas.InscricaoAtleta.length = 0
  const limpa = await json(await inscrever([{ atletaId: adultaDados.id, numero: 1 }, { atletaId: dani.id, numero: 3 }]))
  assert.equal(limpa.data.status, 'CONFIRMADA')
  assert.deepEqual(limpa.avisosDetalhe, [])
  tabelas.Inscricao.length = 0
  tabelas.InscricaoAtleta.length = 0

  // --- Exclusão: anonimização preservando o histórico ----------------------------------
  const atletaDani = tabelas.Atleta.find((a) => a.id === dani.id)!
  Object.assign(atletaDani, { cpfHash: 'hash-cpf', documentoTipo: 'RG', documentoHash: 'hash-rg', fotoUrl: 'https://x/foto.png' })
  tabelas.AtletaDocumento.push({ atletaId: dani.id, cpfCifrado: '\\x01', telefoneCifrado: '\\x02', documentosPaths: ['a/b.pdf'], responsavelNome: 'Legado' })
  tabelas.InscricaoAtleta.push({ id: 'ia1', inscricaoId: 'i1', atletaId: dani.id, nomeSnapshot: 'Dani Menor', numero: 3 })

  assert.equal((await atletaRota.DELETE(req('DELETE', { motivo: 123 }), paramsAtleta(dani.id))).status, 422, 'motivo inválido')
  assert.equal((await atletaRota.DELETE(req('DELETE', undefined, '{quebrado'), paramsAtleta(dani.id))).status, 422, 'corpo inválido')
  await entrar('user-ass')
  assert.equal((await atletaRota.DELETE(req('DELETE', { motivo: 'x' }), paramsAtleta(dani.id))).status, 403, 'assistente não exclui')
  assert.equal(atletaDani.cpfHash, 'hash-cpf')
  await entrar('user-tec')
  const del = await atletaRota.DELETE(req('DELETE', { motivo: 'Pedido da mãe por e-mail' }), paramsAtleta(dani.id))
  assert.equal(del.status, 200)
  assert.deepEqual((await json(del)).data, { removido: true, anonimizado: true })
  assert.equal(atletaDani.cpfHash, null)
  assert.equal(atletaDani.documentoHash, null)
  assert.equal(atletaDani.documentoTipo, null)
  assert.equal(atletaDani.fotoUrl, null)
  assert.ok(atletaDani.anonimizadoEm)
  assert.equal(atletaDani.nome, 'Dani Menor', 'nome fica para o histórico de jogos (decisão jurídica pendente)')
  assert.equal(tabelas.AtletaDocumento.length, 0, 'documentos e telefones apagados')
  const consDani = tabelas.AtletaConsentimento.find((c) => c.atletaId === dani.id)!
  assert.equal(consDani.responsavelContatoCifrado, null)
  assert.equal(consDani.responsavelNome, null)
  assert.ok(consDani.revogadoEm && consDani.versaoTermo, 'a prova do aceite fica, sem dados do responsável')
  assert.equal(tabelas.InscricaoAtleta[0].nomeSnapshot, 'Dani Menor', 'histórico preservado')
  assert.equal(tabelas.VinculoAtletaClube.find((v) => v.atletaId === dani.id)!.status, 'INATIVO')
  assert.equal(tabelas.AtletaExclusaoPedido.length, 1)
  const pedido = tabelas.AtletaExclusaoPedido[0]
  assert.deepEqual(
    [pedido.atletaId, pedido.solicitadoPor, pedido.motivo, pedido.escopo],
    [dani.id, 'user-tec', 'Pedido da mãe por e-mail', 'ANONIMIZACAO'],
  )
  assert.ok(pedido.solicitadoEm !== undefined || pedido.concluidoEm, 'registra quando')
  assert.ok(pedido.concluidoEm)
  assert.equal((await atletaRota.DELETE(req('DELETE'), paramsAtleta(dani.id))).status, 404, 'já removido')

  // Atleta ativo em outro clube: só o vínculo deste clube sai; a PII é preservada para o outro clube.
  const compartilhada = tabelas.Atleta.find((a) => a.id === adultaDados.id)!
  Object.assign(compartilhada, { cpfHash: 'hash-ana' })
  tabelas.VinculoAtletaClube.push({ clubeId: 'outro-clube', atletaId: adultaDados.id, status: 'ATIVO' })
  const delCompartilhada = await json(await atletaRota.DELETE(req('DELETE'), paramsAtleta(adultaDados.id)))
  assert.deepEqual(delCompartilhada.data, { removido: true, anonimizado: false })
  assert.equal(compartilhada.cpfHash, 'hash-ana')
  assert.equal(tabelas.AtletaExclusaoPedido[1].escopo, 'VINCULO')
  assert.equal(tabelas.AtletaExclusaoPedido[1].motivo, null)

  // --- Migration ausente: tolerância ----------------------------------------------------
  const semMigration = tabelasBase()
  delete (semMigration as any).AtletaConsentimento
  delete (semMigration as any).AtletaExclusaoPedido
  banco.atual = criarBancoEscrita(semMigration, {
    unicos: { MembroEquipe: [['timeId', 'usuarioId']] },
  })
  await entrar('user-a')
  const eq2 = (await json(await equipes.POST(new NextRequest('http://127.0.0.1:3001/api/meu-time/equipes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Sem Migration', naipe: 'FEMININO' }),
  })))).data
  const p2 = { params: { id: eq2.id } }
  const menorSem = await json(await atletasRota.POST(req('POST', { nome: 'Fabi Menor', dataNascimento: nascimentoHaAnos(14) }), p2))
  assert.equal(menorSem.data.consentimentoPendente, true, 'sem tabela, todo menor aparece pendente')
  const tentativa = await atletasRota.POST(req('POST', { nome: 'Gabi Menor', dataNascimento: nascimentoHaAnos(14), responsavel, aceiteResponsavel: true }), p2)
  assert.equal(tentativa.status, 503, 'sem tabela de consentimento não finge que gravou')
  const delSem = await json(await atletaRota.DELETE(req('DELETE'), { params: { id: eq2.id, atletaId: menorSem.data.id } }))
  assert.deepEqual(delSem.data, { removido: true, anonimizado: false }, 'sem a migration, só desativa o vínculo')

  console.log('lgpd-menores: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
