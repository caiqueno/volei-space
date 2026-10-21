import assert from 'node:assert/strict'
import { elencoCompletoAtivo } from '../src/lib/meu-time-elenco-ui/flag'
import { cpfValido, emailValido, formatarCpf, formatarTelefone, pareceMascara, telefoneValido, validarContatoAtleta } from '../src/lib/meu-time-elenco-ui/mascaras'
import {
  aceitaDoCampo, limiteFinalBytes, montarPedidoAssinatura, montarPedidoConfirmacao, nomeSeguro, ocupado, podeTentarDeNovo,
  proximoEstadoUpload, retanguloRecorteQuadrado, textoEstadoUpload, UPLOAD_OCIOSO, validarArquivoEscolhido, validarArquivoFinal,
} from '../src/lib/meu-time-elenco-ui/upload'
import { atletaEmPedidoPendente, normalizarPedidos, podeCancelarPedido, regraBotaoTroca, validarPedidoTroca } from '../src/lib/meu-time-elenco-ui/troca'
import { exigenciasDaRegra, pendenciasDoElenco, textoPendencia } from '../src/lib/meu-time-elenco-ui/prontidao'
import { corDoTextoSobre, descricaoUniforme, nomeDaCor, corValida } from '../src/lib/meu-time-elenco-ui/cores'
import { validarDadosTime } from '../src/lib/meu-time-elenco-ui/dados-time'
import { enviarArquivoMeuTime, ErroUpload, obterUrlDocumentoAtleta } from '../src/lib/uploads-cliente'

async function main() {
  // flag
  assert.equal(elencoCompletoAtivo('1'), true)
  assert.equal(elencoCompletoAtivo('0'), false)
  assert.equal(elencoCompletoAtivo(undefined), false)
  assert.equal(elencoCompletoAtivo('true'), false)

  // máscaras
  assert.equal(formatarCpf('52998224725'), '529.982.247-25')
  assert.equal(formatarCpf('5299'), '529.9')
  assert.equal(formatarTelefone('11987654321'), '(11) 98765-4321')
  assert.equal(formatarTelefone('1134567890'), '(11) 3456-7890')
  assert.equal(formatarTelefone('1'), '(1')
  assert.equal(cpfValido('529.982.247-25'), true)
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(cpfValido('111.111.111-11'), false)
  assert.equal(cpfValido('123'), false)
  assert.equal(telefoneValido('(11) 98765-4321'), true)
  assert.equal(telefoneValido('(11) 8765-4321'), true)
  assert.equal(telefoneValido('(11) 88765-4321'), false)
  assert.equal(telefoneValido('11111111111'), false)
  assert.equal(emailValido('time@exemplo.com'), true)
  assert.equal(emailValido('time@exemplo'), false)
  assert.equal(pareceMascara('***.***.***-12'), true)
  assert.equal(pareceMascara('529.982.247-25'), false)

  // contato do atleta: campo vazio fica fora do corpo; máscara nunca vira valor
  const vazio = { cpf: '', documentoTipo: '', documentoNumero: '', telefone: '', telefoneEmergencia: '' }
  assert.deepEqual(validarContatoAtleta(vazio), { valido: true, erros: {}, dados: {} })
  const ok = validarContatoAtleta({ cpf: '529.982.247-25', documentoTipo: 'RG', documentoNumero: ' 12.345.678-9 ', telefone: '(11) 98765-4321', telefoneEmergencia: '' })
  assert.equal(ok.valido, true)
  assert.deepEqual(ok.dados, { cpf: '52998224725', documentoTipo: 'RG', documentoNumero: '12.345.678-9', telefone: '11987654321' })
  const ruim = validarContatoAtleta({ cpf: '123.456.789-00', documentoTipo: '', documentoNumero: '1234', telefone: '123', telefoneEmergencia: '' })
  assert.equal(ruim.valido, false)
  assert.ok(ruim.erros.cpf && ruim.erros.documentoTipo && ruim.erros.telefone)

  // upload: validação
  assert.equal(validarArquivoEscolhido('FOTO_ROSTO', { type: 'image/jpeg', size: 1000 }), null)
  assert.ok(validarArquivoEscolhido('FOTO_ROSTO', { type: 'application/pdf', size: 1000 }))
  assert.equal(validarArquivoEscolhido('DOCUMENTO', { type: 'application/pdf', size: 1000 }), null)
  assert.ok(validarArquivoEscolhido('DOCUMENTO', { type: 'application/pdf', size: 6 * 1024 * 1024 }))
  assert.ok(validarArquivoEscolhido('ESCUDO', { type: 'image/gif', size: 1000 }))
  assert.ok(validarArquivoEscolhido('ESCUDO', { type: 'image/png', size: 0 }))
  assert.ok(validarArquivoEscolhido('ESCUDO', { type: 'image/png', size: 25 * 1024 * 1024 }))
  assert.equal(validarArquivoFinal('ESCUDO', { type: 'image/webp', size: 2 * 1024 * 1024 }), null)
  assert.ok(validarArquivoFinal('ESCUDO', { type: 'image/webp', size: 2 * 1024 * 1024 + 1 }))
  assert.equal(limiteFinalBytes('DOCUMENTO', { type: 'application/pdf' }), 5 * 1024 * 1024)
  assert.equal(limiteFinalBytes('DOCUMENTO', { type: 'image/webp' }), 2 * 1024 * 1024)
  assert.match(aceitaDoCampo('DOCUMENTO'), /application\/pdf/)
  assert.doesNotMatch(aceitaDoCampo('FOTO_ROSTO'), /pdf/)

  // upload: montagem
  assert.deepEqual(
    montarPedidoAssinatura({ equipeId: 'eq1', atletaId: 'at1', tipo: 'FOTO_ROSTO', arquivo: { name: 'Minha Foto Ç.webp', type: 'image/webp', size: 1234 } }),
    { equipeId: 'eq1', tipo: 'FOTO_ROSTO', nomeArquivo: 'Minha-Foto-C.webp', contentType: 'image/webp', tamanho: 1234, atletaId: 'at1' },
  )
  const escudo = montarPedidoAssinatura({ equipeId: 'eq1', atletaId: 'at9', tipo: 'ESCUDO', arquivo: { name: 'e.png', type: 'image/png', size: 5 } })
  assert.equal('atletaId' in escudo, false)
  assert.throws(() => montarPedidoAssinatura({ equipeId: 'eq1', tipo: 'DOCUMENTO', arquivo: { name: 'd.pdf', type: 'application/pdf', size: 5 } }), /Salve o atleta/)
  assert.deepEqual(montarPedidoConfirmacao({ equipeId: 'eq1', atletaId: 'at1', tipo: 'DOCUMENTO' }, 'a/b.pdf'), { equipeId: 'eq1', tipo: 'DOCUMENTO', path: 'a/b.pdf', atletaId: 'at1' })
  assert.equal(nomeSeguro('../../etc/passwd'), 'etc-passwd')
  assert.equal(nomeSeguro('***'), 'arquivo')

  // upload: estados
  let e = UPLOAD_OCIOSO
  e = proximoEstadoUpload(e, { tipo: 'escolheu' })
  assert.equal(e.fase, 'preparando')
  assert.equal(ocupado(e), true)
  e = proximoEstadoUpload(e, { tipo: 'preparado' })
  assert.equal(e.fase, 'enviando')
  assert.equal(textoEstadoUpload(e, 'documento'), 'Enviando documento…')
  e = proximoEstadoUpload(e, { tipo: 'falhou', mensagem: 'Sem conexão.' })
  assert.equal(podeTentarDeNovo(e), true)
  assert.equal(textoEstadoUpload(e, 'documento'), 'Sem conexão.')
  e = proximoEstadoUpload(e, { tipo: 'preparado' })
  e = proximoEstadoUpload(e, { tipo: 'enviou' })
  assert.equal(textoEstadoUpload(e, 'documento'), 'Documento enviado.')
  assert.equal(ocupado(e), false)
  assert.equal(proximoEstadoUpload(e, { tipo: 'removeu' }).fase, 'ocioso')

  // recorte quadrado
  assert.deepEqual(retanguloRecorteQuadrado(800, 400), { x: 200, y: 0, lado: 400 })
  assert.deepEqual(retanguloRecorteQuadrado(800, 400, 0), { x: 0, y: 0, lado: 400 })
  assert.deepEqual(retanguloRecorteQuadrado(800, 400, 1), { x: 400, y: 0, lado: 400 })
  assert.deepEqual(retanguloRecorteQuadrado(300, 900, 0.5), { x: 0, y: 300, lado: 300 })
  assert.deepEqual(retanguloRecorteQuadrado(500, 500), { x: 0, y: 0, lado: 500 })
  assert.deepEqual(retanguloRecorteQuadrado(800, 400, 7), { x: 400, y: 0, lado: 400 })

  // troca: regra do botão pelo prazo
  const prazo = '2026-10-20T12:00:00.000Z'
  const antes = regraBotaoTroca(prazo, new Date('2026-10-20T11:59:59.000Z'))
  assert.equal(antes.modo, 'livre')
  assert.equal(antes.rotuloBotao, 'Trocar atleta')
  assert.match(antes.explicacao, /livremente/)
  const depois = regraBotaoTroca(prazo, new Date('2026-10-20T12:00:00.000Z'))
  assert.equal(depois.modo, 'pedir')
  assert.equal(depois.rotuloBotao, 'Pedir troca')
  assert.match(depois.explicacao, /pedido/)
  assert.equal(regraBotaoTroca(null).modo, 'livre')
  assert.equal(regraBotaoTroca(undefined).modo, 'livre')
  assert.equal(regraBotaoTroca('lixo').modo, 'livre')

  // troca: pedidos
  const pedidos = normalizarPedidos({
    pedidos: [
      { id: 'p1', sai: { id: 'a1', nome: 'Ana' }, entra: 'a2', estado: 'PENDENTE', motivo: 'Lesão' },
      { id: 'p2', sai: 'a3', entra: 'a4', status: 'RECUSADA', motivoRecusa: 'Fora do prazo' },
      { id: 'p3', sai: 'a5', entra: 'a6', estado: 'APROVADO' },
      { sem: 'id' },
    ],
  })
  assert.equal(pedidos.length, 3)
  assert.deepEqual(pedidos.map((p) => p.estado), ['PENDENTE', 'RECUSADO', 'APROVADO'])
  assert.equal(pedidos[1].motivoRecusa, 'Fora do prazo')
  assert.equal(podeCancelarPedido(pedidos[0]), true)
  assert.equal(podeCancelarPedido(pedidos[2]), false)
  assert.equal(atletaEmPedidoPendente(pedidos, 'a2'), true)
  assert.equal(atletaEmPedidoPendente(pedidos, 'a4'), false)
  assert.deepEqual(normalizarPedidos(null), [])
  assert.equal(validarPedidoTroca({ sai: '', entra: '', motivo: '' }).valido, false)
  assert.equal(validarPedidoTroca({ sai: 'a', entra: 'a', motivo: '' }).erros.entra, 'Quem entra precisa ser outra pessoa.')
  assert.deepEqual(validarPedidoTroca({ sai: 'a', entra: 'b', motivo: '  ' }).dados, { sai: 'a', entra: 'b' })
  assert.deepEqual(validarPedidoTroca({ sai: 'a', entra: 'b', motivo: ' Lesão  no joelho ' }).dados, { sai: 'a', entra: 'b', motivo: 'Lesão no joelho' })
  assert.ok(validarPedidoTroca({ sai: 'a', entra: 'b', motivo: 'x'.repeat(301) }).erros.motivo)

  // prontidão por exigência da categoria
  assert.deepEqual(exigenciasDaRegra([]), [])
  assert.deepEqual(exigenciasDaRegra(undefined), [])
  assert.deepEqual(exigenciasDaRegra(['RG', 'foto_rosto', 'CPF', 'CNH']), ['DOCUMENTO', 'FOTO', 'CPF'])
  const atletas = [
    { id: '1', nome: 'Ana', temDocumento: true, temFoto: true, cpf: '***.***.***-12' },
    { id: '2', nome: 'Bia', temDocumento: false, temFoto: true },
    { id: '3', nome: 'Cris', temDocumento: false, temFoto: false },
  ]
  const pend = pendenciasDoElenco(atletas, ['DOCUMENTO', 'FOTO', 'CPF'])
  assert.deepEqual(pend.map((p) => p.atletas.map((a) => a.id)), [['2', '3'], ['3'], ['2', '3']])
  assert.equal(textoPendencia('DOCUMENTO', 2), '2 atletas sem documento')
  assert.equal(textoPendencia('FOTO', 1), '1 atleta sem foto')
  assert.equal(textoPendencia('CPF', 3), '3 atletas sem CPF')

  // cores e dados do time
  assert.equal(corValida('#1D4ED8'), true)
  assert.equal(corValida('1D4ED8'), false)
  assert.equal(nomeDaCor('#1D4ED8'), 'azul')
  assert.equal(nomeDaCor('#FFFFFF'), 'branco')
  assert.equal(corDoTextoSobre('#FFFFFF'), '#000000')
  assert.equal(corDoTextoSobre('#0B1F4D'), '#FFFFFF')
  assert.equal(descricaoUniforme('#0B1F4D', '#F59E0B'), 'Uniforme: camisa azul-marinho, detalhes dourado.')
  assert.equal(descricaoUniforme('', ''), 'Uniforme sem cores definidas.')
  const base = { contatoEmail: '', contatoTelefone: '', corPrimaria: '', corSecundaria: '' }
  assert.deepEqual(validarDadosTime(base).dados, {})
  const dt = validarDadosTime({ contatoEmail: 'a@b.co', contatoTelefone: '(11) 98765-4321', corPrimaria: '#1d4ed8', corSecundaria: '' })
  assert.equal(dt.valido, true)
  assert.deepEqual(dt.dados, { contatoEmail: 'a@b.co', contatoTelefone: '11987654321', corPrimaria: '#1D4ED8' })
  const dtRuim = validarDadosTime({ ...base, contatoEmail: 'x', corPrimaria: 'azul' })
  assert.ok(dtRuim.erros.contatoEmail && dtRuim.erros.corPrimaria)
  // Telefone mascarado salvo e campo intocado: nada vai ao servidor; e-mail e cor apagados viram null
  assert.deepEqual(validarDadosTime(base, { contatoTelefone: '(11) *****-4321' }).dados, {})
  assert.deepEqual(validarDadosTime(base, { contatoEmail: 'a@b.co', corPrimaria: '#1D4ED8' }).dados, { contatoEmail: null, corPrimaria: null })

  // cliente de upload: assinar -> PUT -> confirmar
  const chamadas: Array<{ url: string; metodo: string; corpo?: unknown; tipo?: string }> = []
  const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  const arquivo = new Blob(['abc'], { type: 'image/webp' }) as Blob & { name: string }
  Object.defineProperty(arquivo, 'name', { value: 'foto.webp' })
  const fetchOk = async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method ?? 'GET', corpo: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body, tipo: (init?.headers as Record<string, string> | undefined)?.['Content-Type'] })
    if (url.endsWith('/assinar')) return resposta(200, { data: { uploadUrl: 'https://storage.exemplo/upload?token=t', path: 'eq1/at1/foto.webp', expiraEm: 'x' } })
    if (url.startsWith('https://storage.exemplo')) return new Response(null, { status: 200 })
    return resposta(200, { data: { ok: true } })
  }
  const r = await enviarArquivoMeuTime({ equipeId: 'eq1', atletaId: 'at1', tipo: 'FOTO_ROSTO', arquivo }, { fetchImpl: fetchOk })
  assert.equal(r.path, 'eq1/at1/foto.webp')
  assert.deepEqual(chamadas.map((c) => `${c.metodo} ${c.url}`), [
    'POST /api/meu-time/uploads/assinar',
    'PUT https://storage.exemplo/upload?token=t',
    'POST /api/meu-time/uploads/confirmar',
  ])
  assert.deepEqual(chamadas[0].corpo, { equipeId: 'eq1', tipo: 'FOTO_ROSTO', nomeArquivo: 'foto.webp', contentType: 'image/webp', tamanho: 3, atletaId: 'at1' })
  assert.equal(chamadas[1].tipo, 'image/webp')
  assert.deepEqual(chamadas[2].corpo, { equipeId: 'eq1', tipo: 'FOTO_ROSTO', path: 'eq1/at1/foto.webp', atletaId: 'at1' })

  // falhas: mensagens simples e nada técnico
  const falha = async (status: number, codigo?: string) => {
    try {
      await enviarArquivoMeuTime({ equipeId: 'eq1', tipo: 'ESCUDO', arquivo }, { fetchImpl: async () => resposta(status, { error: 'detalhe interno supabase', codigo }) })
    } catch (erro) {
      assert.ok(erro instanceof ErroUpload)
      assert.doesNotMatch(erro.message, /supabase|interno/)
      return erro
    }
    throw new Error('devia falhar')
  }
  assert.match((await falha(404)).message, /ainda não está ligado/)
  assert.match((await falha(503)).message, /não está habilitado/)
  assert.match((await falha(413)).message, /maior/)
  assert.match((await falha(500)).message, /Tente novamente/)
  const semRede = await enviarArquivoMeuTime({ equipeId: 'eq1', tipo: 'ESCUDO', arquivo }, { fetchImpl: async () => { throw new TypeError('x') } }).catch((x) => x)
  assert.match(semRede.message, /Sem conexão/)
  // PUT falhou: não confirma
  const passos: string[] = []
  await assert.rejects(enviarArquivoMeuTime({ equipeId: 'eq1', tipo: 'ESCUDO', arquivo }, {
    fetchImpl: async (url, init) => {
      passos.push(`${init?.method} ${url}`)
      if (url.endsWith('/assinar')) return resposta(200, { data: { uploadUrl: 'https://s/u', path: 'p' } })
      return new Response(null, { status: 500 })
    },
  }))
  assert.equal(passos.length, 2)

  // documento-url
  const url = await obterUrlDocumentoAtleta('at 1', { fetchImpl: async (u) => { assert.equal(u, '/api/meu-time/atletas/at%201/documento-url'); return resposta(200, { data: { url: 'https://x/doc', expiraEm: 'y' } }) } })
  assert.equal(url, 'https://x/doc')
  await assert.rejects(obterUrlDocumentoAtleta('a', { fetchImpl: async () => resposta(404, { error: 'x' }) }), /não encontrado/)

  console.log('meu-time-elenco-ui.test ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
