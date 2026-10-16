import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { GET, POST } from '../src/app/api/sumula/[token]/eventos/route'

const contexto = { params: Promise.resolve({ token: 'qualquer-token' }) }

async function main() {
  delete process.env.SUMULA_EVENTOS_ATIVO

  const get = await GET(new NextRequest('http://localhost/api/sumula/qualquer-token/eventos'), contexto)
  assert.equal(get.status, 404, 'desligada por padrão: GET responde 404')

  const post = await POST(
    new NextRequest('http://localhost/api/sumula/qualquer-token/eventos', { method: 'POST', body: '{}' }),
    contexto,
  )
  assert.equal(post.status, 404, 'desligada por padrão: POST responde 404')

  process.env.SUMULA_EVENTOS_ATIVO = '0'
  const zero = await GET(new NextRequest('http://localhost/api/sumula/qualquer-token/eventos'), contexto)
  assert.equal(zero.status, 404, 'valor diferente de 1 continua desligado')

  console.log('sumula-eventos-rota.test.ts: 3 casos ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
