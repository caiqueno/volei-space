import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { lerPdf } from './sumula-pdf-leitor'

// Banco falso: a autenticação por token é do módulo sumula-access; aqui ele devolve uma partida de exemplo.
function stub(caminho: string, exports: Record<string, unknown>) {
  const resolvido = require.resolve(caminho)
  require.cache[resolvido] = { id: resolvido, filename: resolvido, loaded: true, exports } as unknown as NodeJS.Module
}

const partida = {
  id: 321, ligaId: 1, rodada: 1, fase: 'GRUPOS', status: 'ENCERRADA', categoria: 'Adulto', dataHora: '2026-05-10T15:00:00.000Z', localNome: 'Ginásio Açaí',
  setsPorA: 1, setsPorB: 0, vencedorId: 1, sumulaToken: 'segredo-do-token', sumulaTokenExpira: null,
  liga: { id: 1, nome: 'Copa Teste', organizadorId: 'org-secreto' },
  equipeA: { id: 1, nome: 'Alfa', jogadores: [{ id: 1, nome: 'Ana Maria Souza', numero: 1, cpf: '111.222.333-44', telefone: '(11) 99999-0000', dataNascimento: '2000-01-01' }] },
  equipeB: { id: 2, nome: 'Beta', jogadores: [{ id: 2, nome: 'Bia Lima', numero: 2, cpf: '555.666.777-88' }] },
  presencas: [], sets: [{ id: 1, numero: 1, pontosA: 25, pontosB: 20 }], ocorrencias: [], destaques: [], escala: [{ id: 1, cargo: 'PRIMEIRO', arbitro: { nome: 'Juiz Um' } }],
}

stub('../src/lib/sumula-access', {
  requireSumulaTokenAccess: async (token: string) => {
    if (token === 'token-expirado') return NextResponse.json({ error: 'O link da súmula expirou.' }, { status: 410 })
    return token === 'token-valido' ? { partida: JSON.parse(JSON.stringify(partida)) } : NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })
  },
})
stub('../src/lib/numero-herdado-leitura', { anexarNumerosHerdados: async () => undefined })

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../src/app/api/sumula/[token]/pdf/route') as typeof import('../src/app/api/sumula/[token]/pdf/route')

const chamar = (token: string, ip = '10.0.0.1') =>
  GET(new NextRequest(`http://localhost/api/sumula/${token}/pdf`, { headers: { 'x-real-ip': ip } }), { params: Promise.resolve({ token }) })

async function main() {
  delete process.env.SUMULA_PDF_ATIVO
  const desligada = await chamar('token-valido')
  assert.equal(desligada.status, 404, 'flag desligada: 404')
  assert.ok((await desligada.json()).error, 'envelope {error}')
  process.env.SUMULA_PDF_ATIVO = '0'
  assert.equal((await chamar('token-valido')).status, 404, 'valor diferente de 1 continua desligado')

  process.env.SUMULA_PDF_ATIVO = '1'
  const invalido = await chamar('token-inexistente')
  assert.equal(invalido.status, 404, 'token inválido: 404')
  assert.ok((await invalido.json()).error)
  assert.equal((await chamar('123')).status, 404, 'id numérico não é credencial')
  assert.equal((await chamar('token-expirado')).status, 410, 'expirado: 410 vindo do controle de acesso')

  const ok = await chamar('token-valido')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'application/pdf')
  assert.equal(ok.headers.get('cache-control'), 'no-store')
  assert.equal(ok.headers.get('content-disposition'), 'attachment; filename="sumula-321-2026-05-10.pdf"')
  const bytes = Buffer.from(await ok.arrayBuffer())
  assert.equal(Number(ok.headers.get('content-length')), bytes.length)
  const pdf = lerPdf(bytes)
  for (const esperado of ['Súmula oficial de vôlei', 'Copa Teste', 'Ginásio Açaí', 'ALFA', 'BETA', 'ANA S.', 'Assinaturas', 'Juiz Um']) {
    assert.ok(pdf.texto.includes(esperado), `PDF contém "${esperado}"`)
  }
  const bruto = bytes.toString('latin1')
  for (const proibido of ['111.222', '99999', '2000-01-01', '555.666', 'segredo-do-token', 'org-secreto']) {
    assert.ok(!bruto.includes(proibido), `PDF não contém ${proibido}`)
  }

  // Rate limit por IP: 20 por janela; a 21ª é 429 com Retry-After e envelope {error}.
  let ultimo = ok
  for (let i = 0; i < 25; i++) ultimo = await chamar('token-valido', '10.9.9.9')
  assert.equal(ultimo.status, 429)
  assert.ok(Number(ultimo.headers.get('retry-after')) >= 1)
  assert.ok((await ultimo.json()).error)

  console.log('sumula-pdf-rota.test.ts: ok.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
