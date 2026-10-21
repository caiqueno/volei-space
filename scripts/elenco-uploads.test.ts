import assert from 'node:assert/strict'
import { IDS, bancoComTabelas, criarAmbiente } from './helpers/ambiente-elenco'

const amb = criarAmbiente()
const { req, json, entrar } = amb

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const A1 = IDS.atleta(1)

async function main() {
  const assinar = await import('../src/app/api/meu-time/uploads/assinar/route')
  const confirmar = await import('../src/app/api/meu-time/uploads/confirmar/route')
  const docLider = await import('../src/app/api/meu-time/atletas/[id]/documento-url/route')
  const docOrg = await import('../src/app/api/organizador/inscricoes/[inscricaoId]/atletas/[atletaId]/documento-url/route')
  const { reiniciarCotas } = await import('../src/lib/rate-limit')

  const assinarCorpo = (extra: Record<string, unknown> = {}) => ({
    equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', nomeArquivo: 'rosto.jpg', contentType: 'image/jpeg', tamanho: 100_000, ...extra,
  })
  const chamarAssinar = async (corpo: unknown) => assinar.POST(req('POST', '/api/meu-time/uploads/assinar', corpo))
  const chamarConfirmar = async (corpo: unknown) => confirmar.POST(req('POST', '/api/meu-time/uploads/confirmar', corpo))

  // --- Flags: desligada = 404 (as duas) -------------------------------------------------
  amb.banco.atual = bancoComTabelas().banco
  await entrar('lider')
  delete process.env.ELENCO_COMPLETO_ATIVO
  process.env.MEU_TIME_ATIVO = '1'
  assert.equal((await chamarAssinar(assinarCorpo())).status, 404, 'ELENCO_COMPLETO_ATIVO desligada = 404')
  process.env.ELENCO_COMPLETO_ATIVO = '1'
  delete process.env.MEU_TIME_ATIVO
  assert.equal((await chamarAssinar(assinarCorpo())).status, 404, 'MEU_TIME_ATIVO desligada = 404')
  process.env.MEU_TIME_ATIVO = '1'
  amb.sessao.token = null
  assert.equal((await chamarAssinar(assinarCorpo())).status, 401, 'sem sessão')

  // --- Assinar ---------------------------------------------------------------------------
  let ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  await entrar('lider')
  reiniciarCotas()
  let r = await chamarAssinar(assinarCorpo())
  assert.equal(r.status, 200)
  let corpo = await json(r)
  assert.deepEqual(Object.keys(corpo.data).sort(), ['expiraEm', 'path', 'uploadUrl'])
  assert.match(corpo.data.path, new RegExp(`^${A1}/[0-9a-f-]{36}\\.jpg$`), 'path gerado no servidor: atleta/uuid.ext')
  assert.ok(!corpo.data.path.includes('rosto'), 'o nome enviado nunca entra no path')
  assert.match(corpo.data.path.split('/')[1].replace('.jpg', ''), UUID)
  assert.ok(corpo.data.uploadUrl.includes('atleta-foto-rosto'), 'bucket do tipo')
  assert.ok(new Date(corpo.data.expiraEm).getTime() > Date.now())
  const caminhoFoto = corpo.data.path

  // Nome malicioso não vira path.
  r = await chamarAssinar(assinarCorpo({ nomeArquivo: '../../etc/passwd.jpg' }))
  assert.equal(r.status, 422)
  r = await chamarAssinar(assinarCorpo({ nomeArquivo: 'a/b.jpg' }))
  assert.equal(r.status, 422)

  // MIME, extensão e tamanho.
  assert.equal((await chamarAssinar(assinarCorpo({ contentType: 'application/x-msdownload', nomeArquivo: 'x.exe' }))).status, 415)
  assert.equal((await chamarAssinar(assinarCorpo({ contentType: 'application/pdf', nomeArquivo: 'rosto.pdf' }))).status, 415, 'foto não aceita PDF')
  assert.equal((await chamarAssinar(assinarCorpo({ contentType: 'image/png', nomeArquivo: 'rosto.jpg' }))).status, 415, 'extensão diferente do MIME')
  assert.equal((await chamarAssinar(assinarCorpo({ nomeArquivo: 'semextensao' }))).status, 415)
  assert.equal((await chamarAssinar(assinarCorpo({ tamanho: 2 * 1024 * 1024 + 1 }))).status, 413, 'imagem acima de 2 MB')
  assert.equal((await chamarAssinar(assinarCorpo({ tamanho: 2 * 1024 * 1024 }))).status, 200, 'imagem no limite')
  assert.equal((await chamarAssinar(assinarCorpo({ tamanho: 0 }))).status, 422)
  assert.equal((await chamarAssinar(assinarCorpo({ tipo: 'DOCUMENTO', contentType: 'application/pdf', nomeArquivo: 'rg.pdf', tamanho: 5 * 1024 * 1024 }))).status, 200, 'documento PDF até 5 MB')
  assert.equal((await chamarAssinar(assinarCorpo({ tipo: 'DOCUMENTO', contentType: 'application/pdf', nomeArquivo: 'rg.pdf', tamanho: 5 * 1024 * 1024 + 1 }))).status, 413)
  assert.equal((await chamarAssinar(assinarCorpo({ tipo: 'XPTO' }))).status, 422)

  // Escudo não leva atleta; foto exige atleta.
  r = await chamarAssinar({ equipeId: IDS.EQ, tipo: 'ESCUDO', nomeArquivo: 'e.png', contentType: 'image/png', tamanho: 1000 })
  assert.equal(r.status, 200)
  assert.match((await json(r)).data.path, new RegExp(`^${IDS.EQ}/[0-9a-f-]{36}\\.png$`))
  assert.equal((await chamarAssinar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'ESCUDO', nomeArquivo: 'e.png', contentType: 'image/png', tamanho: 1000 })).status, 422)
  assert.equal((await chamarAssinar(assinarCorpo({ atletaId: undefined }))).status, 422)

  // Isolamento: atleta de outro time, equipe alheia, assistente sem escrita => 404/403.
  assert.equal((await chamarAssinar(assinarCorpo({ atletaId: IDS.atletaB }))).status, 404, 'atleta de outro clube = 404')
  assert.equal((await chamarAssinar(assinarCorpo({ equipeId: IDS.EQ_B }))).status, 404, 'equipe alheia = 404')
  assert.equal((await chamarAssinar(assinarCorpo({ equipeId: 'nao-e-uuid' }))).status, 404)
  await entrar('assist')
  assert.equal((await chamarAssinar(assinarCorpo())).status, 403, 'assistente não escreve')
  await entrar('tec')
  assert.equal((await chamarAssinar(assinarCorpo())).status, 200, 'técnico assina')
  await entrar('outro')
  assert.equal((await chamarAssinar(assinarCorpo())).status, 404, 'líder de outra equipe não assina para esta')

  // Bucket ausente => 503, nunca 500.
  await entrar('lider')
  amb.storage.bucketsAusentes.add('atleta-foto-rosto')
  r = await chamarAssinar(assinarCorpo())
  assert.equal(r.status, 503)
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  amb.storage.bucketsAusentes.clear()

  // --- Confirmar -------------------------------------------------------------------------
  // Sem as colunas novas: 503.
  amb.banco.atual = bancoComTabelas().banco
  amb.colunasAusentes.Atleta = ['fotoRostoPath']
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })
  assert.equal(r.status, 503, 'sem coluna = 503')
  assert.equal((await json(r)).error, 'Recurso ainda não habilitado neste ambiente.')
  delete amb.colunasAusentes.Atleta

  ambiente = bancoComTabelas()
  amb.banco.atual = ambiente.banco
  const atletaLinha = () => ambiente.tabelas.Atleta.find((l) => l.id === A1)!

  // Objeto que não existe no storage => 409, nada gravado.
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })
  assert.equal(r.status, 409)
  assert.equal(atletaLinha().fotoRostoPath, undefined)

  // Path de outro dono / formato estranho => 422.
  const alheio = `${IDS.atletaB}/${'c'.repeat(8)}-cccc-4ccc-8ccc-${'c'.repeat(12)}.jpg`
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: alheio })).status, 422, 'path de outro atleta')
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: `${A1}/../${IDS.atletaB}/x.jpg` })).status, 422)
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: `${A1}/${caminhoFoto.split('/')[1].replace('.jpg', '.pdf')}` })).status, 422, 'foto não aceita .pdf')
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: IDS.atletaB, tipo: 'FOTO_ROSTO', path: alheio })).status, 404, 'atleta de outro clube')

  // MIME real ou tamanho real fora da regra => apaga o objeto e não grava.
  amb.objetos.set(`atleta-foto-rosto/${caminhoFoto}`, { size: 3 * 1024 * 1024, contentType: 'image/jpeg' })
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })
  assert.equal(r.status, 413, 'tamanho real acima do limite, mesmo que o cliente tenha declarado menos')
  assert.ok(amb.removidos.includes(`atleta-foto-rosto/${caminhoFoto}`), 'objeto inválido removido do bucket')
  assert.equal(atletaLinha().fotoRostoPath, undefined)
  amb.objetos.set(`atleta-foto-rosto/${caminhoFoto}`, { size: 1000, contentType: 'text/html' })
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })
  assert.equal(r.status, 415, 'MIME real diferente do declarado')
  assert.equal(atletaLinha().fotoRostoPath, undefined)

  // Caminho feliz: grava o path e a data; repetir é idempotente.
  amb.objetos.set(`atleta-foto-rosto/${caminhoFoto}`, { size: 50_000, contentType: 'image/jpeg' })
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.path, caminhoFoto)
  assert.equal(atletaLinha().fotoRostoPath, caminhoFoto)
  assert.ok(atletaLinha().fotoRostoEnviadaEm)
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: caminhoFoto })).status, 200)

  // Foto nova substitui a antiga e remove o objeto velho.
  const novoCaminho = `${A1}/${'d'.repeat(8)}-dddd-4ddd-8ddd-${'d'.repeat(12)}.png`
  amb.objetos.set(`atleta-foto-rosto/${novoCaminho}`, { size: 40_000, contentType: 'image/png' })
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'FOTO_ROSTO', path: novoCaminho })).status, 200)
  assert.equal(atletaLinha().fotoRostoPath, novoCaminho)
  assert.ok(amb.removidos.includes(`atleta-foto-rosto/${caminhoFoto}`))

  // Documento: bucket privado, PDF, nunca devolve URL.
  const caminhoDoc = `${A1}/${'e'.repeat(8)}-eeee-4eee-8eee-${'e'.repeat(12)}.pdf`
  amb.objetos.set(`atleta-documento/${caminhoDoc}`, { size: 400_000, contentType: 'application/pdf' })
  r = await chamarConfirmar({ equipeId: IDS.EQ, atletaId: A1, tipo: 'DOCUMENTO', path: caminhoDoc })
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.equal(corpo.data.url, undefined, 'documento privado não devolve URL')
  const docLinha = ambiente.tabelas.AtletaDocumento.find((l) => l.atletaId === A1)!
  assert.equal(docLinha.documentoPath, caminhoDoc, 'documento fica em AtletaDocumento (upsert por atletaId)')
  assert.ok(docLinha.documentoEnviadoEm)
  assert.equal(atletaLinha().documentoPath, undefined)

  // Escudo: grava escudoPath e a URL pública.
  const caminhoEscudo = `${IDS.EQ}/${'f'.repeat(8)}-ffff-4fff-8fff-${'f'.repeat(12)}.webp`
  amb.objetos.set(`time-escudo/${caminhoEscudo}`, { size: 10_000, contentType: 'image/webp' })
  r = await chamarConfirmar({ equipeId: IDS.EQ, tipo: 'ESCUDO', path: caminhoEscudo })
  assert.equal(r.status, 200)
  const time = ambiente.tabelas.TimeClube.find((l) => l.id === IDS.EQ)!
  assert.equal(time.escudoPath, caminhoEscudo)
  assert.ok(String(time.escudoUrl).includes('/object/public/time-escudo/'))

  // Líder de outra equipe não confirma na nossa (404), e assistente não confirma (403).
  await entrar('outro')
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, tipo: 'ESCUDO', path: caminhoEscudo })).status, 404)
  await entrar('assist')
  assert.equal((await chamarConfirmar({ equipeId: IDS.EQ, tipo: 'ESCUDO', path: caminhoEscudo })).status, 403)

  // --- URL de leitura do documento (60 s) -------------------------------------------------
  await entrar('lider')
  const docUrl = (id: string) => docLider.GET(req('GET', `/api/meu-time/atletas/${id}/documento-url`), { params: { id } })
  r = await docUrl(A1)
  assert.equal(r.status, 200)
  corpo = await json(r)
  assert.ok(corpo.data.url.includes('atleta-documento'))
  assert.equal(amb.assinadosLeitura.at(-1)!.segundos, 60, 'TTL de 60 s')
  const ttl = new Date(corpo.data.expiraEm).getTime() - Date.now()
  assert.ok(ttl > 50_000 && ttl <= 61_000)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  assert.equal((await docUrl(IDS.atleta(2))).status, 404, 'atleta sem documento')
  assert.equal((await docUrl(IDS.atletaB)).status, 404, 'atleta de outro clube = 404 (IDOR)')
  assert.equal((await docUrl('lixo')).status, 404)
  await entrar('assist')
  assert.equal((await docUrl(A1)).status, 404, 'assistente não lê documento')
  await entrar('outro')
  assert.equal((await docUrl(A1)).status, 404, 'líder de outra equipe = 404')
  amb.sessao.token = null
  assert.equal((await docUrl(A1)).status, 401)

  // Organizador: só dono do campeonato e só atleta ativo na inscrição.
  const docOrgChamar = (inscricaoId: string, atletaId: string) =>
    docOrg.GET(req('GET', `/api/organizador/inscricoes/${inscricaoId}/atletas/${atletaId}/documento-url`), { params: { inscricaoId, atletaId } })
  await entrar('org1', 'organizador')
  reiniciarCotas()
  r = await docOrgChamar(IDS.INS1, A1)
  assert.equal(r.status, 200)
  assert.equal(amb.assinadosLeitura.at(-1)!.segundos, 60)
  assert.equal((await docOrgChamar(IDS.INS1, IDS.atleta(7))).status, 404, 'atleta que não está na inscrição')
  assert.equal((await docOrgChamar(IDS.INS1, IDS.atletaB)).status, 404)
  await entrar('org2', 'organizador')
  assert.equal((await docOrgChamar(IDS.INS1, A1)).status, 404, 'outro organizador = 404 (IDOR)')
  await entrar('lider')
  assert.equal((await docOrgChamar(IDS.INS1, A1)).status, 401, 'líder não usa a rota do organizador')
  delete process.env.ELENCO_COMPLETO_ATIVO
  await entrar('org1', 'organizador')
  assert.equal((await docOrgChamar(IDS.INS1, A1)).status, 404, 'flag desligada = 404')

  console.log('elenco-uploads: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
