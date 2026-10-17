import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { configurarAmbienteSupabase, instalarPostgrestFalso, type Tabelas } from './helpers/postgrest-falso'

configurarAmbienteSupabase()

// A sessão vem do cookie (next/headers), que só existe dentro de uma requisição real do Next.
const sessao: { token: string | null } = { token: null }
const caminhoHeaders = require.resolve('next/headers')
require.cache[caminhoHeaders] = {
  id: caminhoHeaders,
  filename: caminhoHeaders,
  loaded: true,
  exports: { cookies: async () => ({ get: () => (sessao.token ? { value: sessao.token } : undefined) }) },
} as unknown as NodeJS.Module

const UUID = '0b9f3b2e-6a5c-4c1e-9d2f-1a2b3c4d5e6f'
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL as string

async function main() {
  const { normalizarLogoEquipeEntrada } = await import('../src/lib/uploads/logo-equipe')
  const equipe = { id: 1, ligaId: 7 }
  const caminho = `equipe-emblema/liga-7/equipe-1/${UUID}.png`
  const urlPublica = `${BASE}/storage/v1/object/public/equipe-emblemas/${caminho}`

  // Unidade: caminho e URL do próprio Storage/equipe passam; caminho vira URL pública.
  assert.equal(normalizarLogoEquipeEntrada(urlPublica, equipe, null), urlPublica)
  assert.equal(normalizarLogoEquipeEntrada(caminho, equipe, null), urlPublica)
  // Valor já gravado é preservado, mesmo fora do padrão (logo antiga ou do cadastro).
  assert.equal(normalizarLogoEquipeEntrada('https://antigo.example/logo.png', equipe, 'https://antigo.example/logo.png'), 'https://antigo.example/logo.png')
  assert.equal(normalizarLogoEquipeEntrada('https://antigo.example/outra.png', equipe, 'https://antigo.example/logo.png'), null)
  const ruins: unknown[] = [
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://evil.example/logo.png',
    `https://evil.example/storage/v1/object/public/equipe-emblemas/${caminho}`,
    `${BASE.replace('://', '://usuario:senha@')}/storage/v1/object/public/equipe-emblemas/${caminho}`,
    `${BASE}.evil.example/storage/v1/object/public/equipe-emblemas/${caminho}`,
    `${BASE}/storage/v1/object/public/jogador-fotos-rosto/${caminho}`,
    `${BASE}/storage/v1/object/public/equipe-emblemas/equipe-emblema/liga-7/equipe-2/${UUID}.png`,
    `${BASE}/storage/v1/object/public/equipe-emblemas/equipe-emblema/liga-8/equipe-1/${UUID}.png`,
    `${BASE}/storage/v1/object/public/equipe-emblemas/equipe-emblema/liga-7/equipe-1/../equipe-2/x.png`,
    `candidatura-emblema/anonimo/${UUID}.png`,
    `atleta-foto-rosto/liga-7/equipe-1/${UUID}.png`,
    `equipe-emblema/liga-7/equipe-2/${UUID}.png`,
    'qualquer-nome.png',
    42,
    null,
    '',
  ]
  for (const ruim of ruins) assert.equal(normalizarLogoEquipeEntrada(ruim, equipe, null), null, String(ruim))

  // Rota PUT /api/capitao/equipe.
  const { signPublicToken } = await import('../src/lib/auth')
  const tabelas: Tabelas = {
    CandidaturaEquipe: [{ id: 'cap-1', nome: 'Time Azul', status: 'ATIVA', equipeId: 1, ligaId: 7, categoria: 'Adulto', serie: 'A', emblemaUrl: null }],
    Equipe: [{ id: 1, nome: 'TIME AZUL', ligaId: 7, categoria: 'Adulto', serie: 'A', statusEquipe: 'ATIVA', inscricaoAtiva: true, logoUrl: 'https://antigo.example/logo.png', emblemaUrl: 'https://antigo.example/logo.png' }],
  }
  const falso = instalarPostgrestFalso(tabelas)
  try {
    const rota = await import('../src/app/api/capitao/equipe/route')
    sessao.token = await signPublicToken({ userId: 'cap-1', email: 'cap@t.local', nome: 'Cap', tipo: 'equipe', status: 'ATIVA' })
    const put = (corpo: unknown) => rota.PUT(new NextRequest('http://127.0.0.1:3001/api/capitao/equipe', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    }))
    const gravacoes = () => falso.chamadas.filter((c) => c.tabela === 'Equipe' && c.metodo === 'PATCH' && /logoUrl/.test(c.corpo ?? ''))

    for (const logoUrl of ['https://evil.example/pixel.png', 'javascript:alert(1)', `${BASE}/storage/v1/object/public/equipe-emblemas/equipe-emblema/liga-7/equipe-2/${UUID}.png`]) {
      const resposta = await put({ nome: 'Time Azul', logoUrl })
      assert.equal(resposta.status, 422, logoUrl)
    }
    assert.equal(gravacoes().length, 0, 'nada é gravado quando a logo é recusada')

    const aceita = await put({ nome: 'Time Azul', logoUrl: urlPublica })
    assert.equal(aceita.status, 200)
    const gravado = gravacoes().map((c) => JSON.parse(c.corpo ?? '{}'))
    assert.ok(gravado.some((g) => g.logoUrl === urlPublica && g.emblemaUrl === urlPublica), 'grava a URL do próprio Storage')

    falso.chamadas.length = 0
    const preservada = await put({ nome: 'Time Azul', logoUrl: 'https://antigo.example/logo.png' })
    assert.equal(preservada.status, 200, 'logo já gravada é preservada')

    falso.chamadas.length = 0
    const ausente = await put({ nome: 'Time Azul' })
    assert.equal(ausente.status, 200)
    assert.ok(gravacoes().map((c) => JSON.parse(c.corpo ?? '{}')).some((g) => g.logoUrl === 'https://antigo.example/logo.png'), 'campo ausente não apaga a logo')

    falso.chamadas.length = 0
    const limpa = await put({ nome: 'Time Azul', logoUrl: null })
    assert.equal(limpa.status, 200)
    assert.ok(gravacoes().map((c) => JSON.parse(c.corpo ?? '{}')).some((g) => g.logoUrl === null), 'null limpa a logo')
  } finally {
    falso.restaurar()
  }

  console.log('capitao-logo: ok')
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
