import assert from 'node:assert/strict'

async function main() {
  const { enviarArquivoAssinado, obterUrlDocumento, referenciaPrivada, ErroUpload } = await import('../src/lib/uploads-cliente')

  const arquivo = new Blob(['x'], { type: 'image/webp' })
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })

  // publico: assina, envia e devolve a URL publica
  const chamadas: { url: string; init?: RequestInit }[] = []
  const ok = await enviarArquivoAssinado({ tipo: 'equipe-emblema', equipeId: 7, arquivo }, {
    fetchImpl: async (url, init) => {
      chamadas.push({ url, init })
      if (url === '/api/uploads/assinar') {
        const corpo = JSON.parse(String(init?.body))
        assert.deepEqual(corpo, { tipo: 'equipe-emblema', equipeId: 7, mime: 'image/webp', tamanho: 1 })
        return json({ data: { bucket: 'equipe-emblemas', caminho: 'equipe-emblema/liga-1/equipe-7/a.webp', urlAssinada: 'https://x.supabase.co/storage/v1/object/upload/sign/equipe-emblemas/a?token=t', urlPublica: 'https://x.supabase.co/pub/a.webp' } }, 201)
      }
      assert.equal(init?.method, 'PUT')
      return new Response('{}', { status: 200 })
    },
  })
  assert.equal(chamadas.length, 2)
  assert.equal(ok.referencia, 'https://x.supabase.co/pub/a.webp')
  assert.equal(ok.caminho, 'equipe-emblema/liga-1/equipe-7/a.webp')

  // privado: referencia sem token
  const priv = await enviarArquivoAssinado({ tipo: 'atleta-documento', equipeId: 7, arquivo }, {
    fetchImpl: async (url) => url === '/api/uploads/assinar'
      ? json({ data: { bucket: 'atleta-arquivos', caminho: 'atleta-documento/liga-1/equipe-7/b.pdf', urlAssinada: 'https://x.supabase.co/storage/v1/object/upload/sign/atleta-arquivos/b?token=t', urlPublica: null } }, 201)
      : new Response('{}', { status: 200 }),
  })
  assert.equal(priv.urlPublica, null)
  assert.equal(priv.referencia, 'https://x.supabase.co/storage/v1/object/sign/atleta-arquivos/atleta-documento/liga-1/equipe-7/b.pdf')
  assert.ok(!priv.referencia.includes('token'))
  assert.equal(referenciaPrivada('nao e url', 'b', 'c'), null)

  // erros da assinatura viram mensagem amigavel
  for (const [status, trecho] of [[401, 'sessão'], [403, 'permissão'], [415, 'Tipo de arquivo'], [429, 'Aguarde'], [500, 'Não foi possível']] as const) {
    await assert.rejects(
      enviarArquivoAssinado({ tipo: 'equipe-emblema', equipeId: 1, arquivo }, { fetchImpl: async () => json({ error: 'stack interno' }, status) }),
      (erro: unknown) => erro instanceof ErroUpload && erro.message.includes(trecho) && !erro.message.includes('stack') && erro.status === status,
    )
  }
  // 413 repassa o texto do servidor (limite)
  await assert.rejects(
    enviarArquivoAssinado({ tipo: 'equipe-emblema', equipeId: 1, arquivo }, { fetchImpl: async () => json({ error: 'Arquivo acima de 4 MB.' }, 413) }),
    /acima de 4 MB/,
  )
  // falha de rede e falha no PUT
  await assert.rejects(
    enviarArquivoAssinado({ tipo: 'equipe-emblema', equipeId: 1, arquivo }, { fetchImpl: async () => { throw new TypeError('fetch failed') } }),
    /conexão/,
  )
  await assert.rejects(
    enviarArquivoAssinado({ tipo: 'equipe-emblema', equipeId: 1, arquivo }, {
      fetchImpl: async (url) => url === '/api/uploads/assinar'
        ? json({ data: { bucket: 'b', caminho: 'c', urlAssinada: 'https://x/y', urlPublica: 'https://x/p' } }, 201)
        : new Response('boom', { status: 400 }),
    }),
    (erro: unknown) => erro instanceof ErroUpload && !erro.message.includes('boom'),
  )

  // leitura de documento
  const visto: string[] = []
  const url = await obterUrlDocumento({ jogadorId: 3, indice: 1 }, {
    fetchImpl: async (u) => { visto.push(u); return json({ data: { url: 'https://assinada' } }) },
  })
  assert.equal(url, 'https://assinada')
  assert.equal(visto[0], '/api/uploads/documento?jogadorId=3&indice=1')
  await obterUrlDocumento({ caminho: 'a/b' }, { fetchImpl: async (u) => { visto.push(u); return json({ data: { url: 'u' } }) } })
  assert.equal(visto[1], '/api/uploads/documento?caminho=a%2Fb')
  await assert.rejects(obterUrlDocumento({ caminho: 'a' }, { fetchImpl: async () => json({ error: 'x' }, 404) }), /não encontrado/)

  console.log('uploads-cliente: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
