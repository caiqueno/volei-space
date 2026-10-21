import assert from 'node:assert/strict'
import { IDS, bancoComTabelas, criarAmbiente } from './helpers/ambiente-elenco'

const amb = criarAmbiente()
const { req, json, entrar } = amb

const A1 = IDS.atleta(1)
const A2 = IDS.atleta(2)
const CPF1 = '529.982.247-25'
const CPF2 = '111.444.777-35'

async function main() {
  const atletaRota = await import('../src/app/api/meu-time/equipes/[id]/atletas/[atletaId]/route')
  const atletaAlias = await import('../src/app/api/meu-time/atletas/[id]/route')
  const equipeRota = await import('../src/app/api/meu-time/equipes/[id]/route')
  const prontidaoRota = await import('../src/app/api/meu-time/equipes/[id]/prontidao/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')
  const { decifrarContato } = await import('../src/lib/lgpd/cifra')

  const patchAtleta = (atletaId: string, corpo: unknown, equipeId = IDS.EQ) =>
    atletaRota.PATCH(req('PATCH', `/api/meu-time/equipes/${equipeId}/atletas/${atletaId}`, corpo), { params: { id: equipeId, atletaId } })
  const getEquipe = (equipeId = IDS.EQ) => equipeRota.GET(req('GET', `/api/meu-time/equipes/${equipeId}`), { params: { id: equipeId } })
  const patchEquipe = (corpo: unknown, equipeId = IDS.EQ) => equipeRota.PATCH(req('PATCH', `/api/meu-time/equipes/${equipeId}`, corpo), { params: { id: equipeId } })

  process.env.MEU_TIME_ATIVO = '1'
  process.env.ELENCO_COMPLETO_ATIVO = '1'
  let ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  await entrar('lider')
  reiniciarCotas()
  const linha = (id: string) => ambiente.tabelas.Atleta.find((l) => l.id === id)!

  // --- (B) dados do atleta: validação ---------------------------------------------------
  let r = await patchAtleta(A1, { cpf: '111.111.111-11' })
  assert.equal(r.status, 422, 'CPF inválido')
  let texto = JSON.stringify(await json(r))
  assert.ok(!texto.includes('111.111.111-11'), 'a mensagem de erro não repete o CPF')
  assert.equal((await patchAtleta(A1, { cpf: '529.982.247-24' })).status, 422, 'dígito verificador errado')
  assert.equal((await patchAtleta(A1, { telefone: '12345' })).status, 422, 'telefone inválido')
  assert.equal((await patchAtleta(A1, { documentoTipo: 'RG' })).status, 422, 'tipo sem número')
  assert.equal((await patchAtleta(A1, { documentoNumero: 'MG123456' })).status, 422, 'número sem tipo')
  assert.equal((await patchAtleta(A1, { documentoTipo: 'XYZ', documentoNumero: 'MG123456' })).status, 422)
  assert.equal(linha(A1).cpfHash, undefined, 'nada gravado nos pedidos inválidos')

  // --- grava, cifra e devolve só máscara -------------------------------------------------
  r = await patchAtleta(A1, { cpf: CPF1, telefone: '(11) 98765-5678', telefoneEmergencia: '+55 21 3344-5678', documentoTipo: 'RG', documentoNumero: 'mg-12.345.678' })
  assert.equal(r.status, 200)
  let corpo = await json(r)
  texto = JSON.stringify(corpo)
  assert.equal(corpo.data.cpfMascarado, '***.***.***-25')
  assert.equal(corpo.data.telefoneMascarado, '(11) *****-5678')
  assert.equal(corpo.data.telefoneEmergenciaMascarado, '(21) ****-5678')
  assert.equal(corpo.data.documentoTipo, 'RG')
  assert.ok(corpo.data.documentoMascarado.endsWith('78') && corpo.data.documentoMascarado.includes('*'))
  assert.equal(corpo.data.temCpf, true)
  assert.equal(corpo.data.temFoto, false)
  assert.equal(corpo.data.temDocumento, false, 'sem arquivo do documento enviado')
  for (const claro of ['52998224725', '529.982.247', '987655678', '98765-5678', '33445678', 'MG12345678']) {
    assert.ok(!texto.includes(claro), `a resposta não pode conter ${claro}`)
  }
  const gravado = linha(A1)
  assert.match(gravado.cpfHash, /^[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(gravado).includes('52998224725'), 'banco sem CPF em claro')
  assert.ok(!JSON.stringify(gravado).includes('11987655678'), 'banco sem telefone em claro')
  const docA1 = ambiente.tabelas.AtletaDocumento.find((l) => l.atletaId === A1)!
  assert.ok(!JSON.stringify(docA1).includes('52998224725') && !JSON.stringify(docA1).includes('11987655678'))
  assert.equal(gravado.cpfCifrado, undefined, 'cifrados ficam em AtletaDocumento, não em Atleta')
  assert.equal(decifrarContato(docA1.cpfCifrado), '52998224725', 'cifrado de verdade (AES-256-GCM)')
  assert.equal(decifrarContato(docA1.telefoneCifrado), '11987655678')
  assert.equal(decifrarContato(docA1.documentoNumeroCifrado), 'MG12345678')
  assert.ok(Buffer.from(docA1.cpfCifrado.replace(/^\\x/, ''), 'hex').length >= 30, 'CHECK octet_length >= 30')
  assert.equal(ambiente.tabelas.AtletaDocumento.filter((l) => l.atletaId === A1).length, 1, 'upsert: uma linha por atleta')
  // Aliases sem sufixo que a tela lê: também só mascarados.
  assert.equal(corpo.data.cpf, '***.***.***-25')
  assert.equal(corpo.data.telefone, '(11) *****-5678')
  assert.equal(corpo.data.telefoneEmergencia, '(21) ****-5678')
  assert.equal(corpo.data.documentoNumero, corpo.data.documentoMascarado)
  assert.equal((await patchAtleta(A2, { documentoTipo: 'CERTIDAO', documentoNumero: 'CN123456' })).status, 200)
  assert.equal((await patchAtleta(A2, { documentoTipo: 'CERTIDAO_NASCIMENTO', documentoNumero: 'CN123456' })).status, 422)
  assert.ok(gravado.documentoHash && gravado.documentoTipo === 'RG')

  // CPF duplicado no mesmo time => 409 CPF_DUPLICADO; outro CPF passa; o mesmo CPF no próprio atleta passa.
  r = await patchAtleta(A2, { cpf: CPF1 })
  assert.equal(r.status, 409)
  assert.equal((await json(r)).codigo, 'CPF_DUPLICADO')
  assert.equal(linha(A2).cpfHash, undefined)
  assert.equal((await patchAtleta(A2, { cpf: CPF2 })).status, 200)
  assert.equal((await patchAtleta(A1, { cpf: CPF1 })).status, 200, 'regravar o próprio CPF não é duplicidade')

  // Campos comuns e sensíveis juntos; null apaga o dado.
  r = await patchAtleta(A1, { nome: 'Atleta Um', telefone: null })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.nome, 'Atleta Um')
  assert.equal(corpo.data.telefoneMascarado, null)
  assert.equal(ambiente.tabelas.AtletaDocumento.find((l) => l.atletaId === A1)!.telefoneCifrado, null)
  assert.equal((await patchAtleta(A1, { cpf: null })).status, 200)
  assert.equal(linha(A1).cpfHash, null)
  assert.equal(ambiente.tabelas.AtletaDocumento.find((l) => l.atletaId === A1)!.cpfCifrado, null)

  // Isolamento e permissão.
  assert.equal((await patchAtleta(IDS.atletaB, { cpf: CPF2 })).status, 404, 'atleta de outro clube pelo nosso time = 404')
  assert.equal((await patchAtleta(A1, { cpf: CPF2 }, IDS.EQ_B)).status, 404, 'equipe alheia = 404')
  await entrar('assist')
  assert.equal((await patchAtleta(A1, { cpf: CPF2 })).status, 403, 'assistente não escreve')
  await entrar('tec')
  assert.equal((await patchAtleta(A1, { telefone: '(11) 98765-1111' })).status, 200, 'técnico escreve')

  // Alias PATCH /api/meu-time/atletas/:id com equipeId no corpo.
  await entrar('lider')
  const alias = (id: string, corpo: unknown) => atletaAlias.PATCH(req('PATCH', `/api/meu-time/atletas/${id}`, corpo), { params: { id } })
  r = await alias(A1, { equipeId: IDS.EQ, cpf: CPF1 })
  assert.equal(r.status, 200)
  assert.equal((await json(r)).data.cpfMascarado, '***.***.***-25')
  assert.equal((await alias(A1, { cpf: CPF1 })).status, 422, 'sem equipeId')
  assert.equal((await alias(A1, { equipeId: IDS.EQ_B, cpf: CPF1 })).status, 404)
  assert.equal((await alias(IDS.atletaB, { equipeId: IDS.EQ, cpf: CPF1 })).status, 404)

  // --- 503 sem coluna: nada muda, nem os campos comuns -------------------------------------
  ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  amb.colunasAusentes.AtletaDocumento = ['cpfCifrado']
  r = await patchAtleta(A1, { nome: 'Novo Nome', cpf: CPF1 })
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  assert.equal(linha(A1).nome, 'Atleta 1', 'campos comuns não foram gravados')
  delete amb.colunasAusentes.AtletaDocumento

  // Sem chave de cifra: 503 (fail-closed), nada em claro.
  const chave = process.env.LGPD_CHAVE_CIFRA
  delete process.env.LGPD_CHAVE_CIFRA
  r = await patchAtleta(A1, { cpf: CPF1 })
  assert.equal(r.status, 503)
  assert.equal(linha(A1).cpfHash, undefined)
  process.env.LGPD_CHAVE_CIFRA = chave

  // --- Leituras: máscara e flags; nunca o valor ---------------------------------------------
  ambiente = bancoComTabelas({
    RegraElenco: [{ categoriaCampeonatoId: IDS.CAT1, ligaId: 1, documentosExigidos: ['FOTO', 'CPF'] }],
  })
  amb.banco.atual = ambiente.banco
  await patchAtleta(A1, { cpf: CPF1, telefone: '(11) 98765-5678' })
  linha(A1).fotoRostoPath = `${A1}/x.jpg`
  ambiente.tabelas.AtletaDocumento.push({ atletaId: A2, documentoPath: `${A2}/y.pdf` })
  r = await getEquipe()
  assert.equal(r.status, 200)
  corpo = await json(r)
  texto = JSON.stringify(corpo)
  assert.ok(!texto.includes('52998224725') && !texto.includes('987655678') && !texto.includes('cpfCifrado') && !texto.includes('cpfHash'), 'GET sem valor em claro nem colunas cruas')
  const a1 = corpo.data.atletas.find((a: any) => a.id === A1)
  const a2 = corpo.data.atletas.find((a: any) => a.id === A2)
  assert.equal(a1.cpfMascarado, '***.***.***-25')
  assert.equal(a1.telefoneMascarado, '(11) *****-5678')
  assert.equal(a1.temFoto, true)
  assert.equal(a2.temDocumento, true)
  assert.equal(a2.temFoto, false)
  assert.equal(a2.temCpf, false)
  assert.deepEqual(corpo.data.prontidao.exigidos, ['FOTO', 'CPF'], 'prontidão conforme a regra de elenco da inscrição')
  assert.equal(corpo.data.prontidao.semFoto, 7)
  assert.equal(corpo.data.prontidao.semCpf, 7)
  assert.match(corpo.data.prontidao.mensagem, /7 estão sem foto/)
  assert.match(corpo.data.prontidao.mensagem, /7 estão sem CPF/)
  assert.ok(!/sem documento/.test(corpo.data.prontidao.mensagem), 'documento não é exigido por esta regra')
  const pr = await json(await prontidaoRota.GET(req('GET', '/p'), { params: { id: IDS.EQ } }))
  assert.equal(pr.data.semFoto, 7)

  // Regra que exige só DOCUMENTO.
  ambiente.tabelas.RegraElenco[0].documentosExigidos = ['DOCUMENTO']
  corpo = await json(await prontidaoRota.GET(req('GET', '/p'), { params: { id: IDS.EQ } }))
  assert.equal(corpo.data.semDocumento, 7)
  assert.match(corpo.data.mensagem, /7 estão sem documento/)
  assert.ok(!/sem foto/.test(corpo.data.mensagem))

  // --- Flag desligada: comportamento antigo, sem campos novos -----------------------------
  delete process.env.ELENCO_COMPLETO_ATIVO
  ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  r = await patchAtleta(A1, { nome: 'So Nome', cpf: CPF1, telefone: '(11) 98765-5678' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.cpfMascarado, undefined)
  assert.equal(corpo.data.temFoto, undefined)
  assert.equal(linha(A1).cpfHash, undefined, 'com a flag desligada os campos novos são ignorados')
  assert.equal(linha(A1).nome, 'So Nome')
  assert.equal((await patchAtleta(A1, { cpf: CPF1 })).status, 422, 'só campo novo = nenhum campo conhecido')
  corpo = await json(await getEquipe())
  assert.equal(corpo.data.dadosDoTime, undefined)
  assert.equal(corpo.data.atletas[0].cpfMascarado, undefined)
  assert.equal((await alias(A1, { equipeId: IDS.EQ, cpf: CPF1 })).status, 404, 'rota nova com a flag desligada = 404')
  process.env.ELENCO_COMPLETO_ATIVO = '1'

  // --- (C) dados do time ------------------------------------------------------------------
  ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  const time = () => ambiente.tabelas.TimeClube.find((l) => l.id === IDS.EQ)!
  assert.equal((await patchEquipe({ corPrimaria: 'vermelho' })).status, 422)
  assert.equal((await patchEquipe({ contatoEmail: 'nao-e-email' })).status, 422)
  assert.equal((await patchEquipe({ contatoTelefone: '123' })).status, 422)
  // CNPJ saiu do escopo: o campo é ignorado como qualquer desconhecido (não é gravado nem devolvido).
  r = await patchEquipe({ cidade: 'Santos', cnpj: '11.222.333/0001-81' })
  assert.equal(r.status, 200)
  assert.equal((time() as any).cnpj, undefined)
  assert.equal((await json(r)).data.dadosDoTime.cnpj, undefined)
  assert.equal((await patchEquipe({ cnpj: '11.222.333/0001-81' })).status, 422, 'só campo desconhecido = nenhum campo conhecido')
  r = await patchEquipe({ contatoEmail: 'Contato@Time.com', contatoTelefone: '(11) 98765-5678', corPrimaria: '#ff0000', corSecundaria: '#00FF00' })
  assert.equal(r.status, 200)
  corpo = await json(r)
  texto = JSON.stringify(corpo)
  assert.equal(corpo.data.dadosDoTime.contatoTelefoneMascarado, '(11) *****-5678')
  assert.equal(corpo.data.dadosDoTime.corPrimaria, '#FF0000')
  assert.ok(!texto.includes('987655678'))
  assert.equal(time().contatoEmail, 'contato@time.com')
  assert.ok(!JSON.stringify(time()).includes('11987655678'), 'telefone do time cifrado')
  assert.equal(decifrarContato(time().contatoTelefoneCifrado), '11987655678')
  r = await patchEquipe({ nome: 'Equipe Renomeada', contatoEmail: null })
  assert.equal(r.status, 200)
  assert.equal(time().nome, 'Equipe Renomeada')
  assert.equal(time().contatoEmail, null)
  corpo = await json(await getEquipe())
  assert.equal(corpo.data.dadosDoTime.corPrimaria, '#FF0000')
  assert.equal(corpo.data.dadosDoTime.contatoTelefoneMascarado, '(11) *****-5678')
  await entrar('tec')
  assert.equal((await patchEquipe({ corPrimaria: '#112233' })).status, 403, 'só o responsável edita o time')
  await entrar('outro')
  assert.equal((await patchEquipe({ corPrimaria: '#112233' })).status, 404, 'equipe alheia = 404')

  // Sem as colunas do time: 503 e nada muda (inclui o nome); a leitura continua funcionando.
  await entrar('lider')
  amb.colunasAusentes.TimeClube = ['contatoEmail']
  r = await patchEquipe({ nome: 'Outro Nome', contatoEmail: 'x@y.co' })
  assert.equal(r.status, 503)
  assert.equal(time().nome, 'Equipe Renomeada')
  assert.equal((await getEquipe()).status, 200, 'leitura tolerante a coluna ausente')
  delete amb.colunasAusentes.TimeClube

  // Flag desligada: o time só aceita os campos antigos.
  delete process.env.ELENCO_COMPLETO_ATIVO
  r = await patchEquipe({ cidade: 'Campinas', cnpj: '11.222.333/0001-81' })
  assert.equal(r.status, 200)
  assert.equal(time().cidade, 'Campinas')
  assert.equal((time() as any).cnpj, undefined, 'campo cnpj desconhecido ignorado sem a flag')
  assert.equal((await json(r)).data.dadosDoTime, undefined)

  console.log('elenco-dados: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
