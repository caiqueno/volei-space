import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { LIGA_CAMPOS_OCULTOS, LIGA_COLUNAS_PUBLICAS } from '../src/lib/liga-colunas'
import { statusInicialDaInscricao } from '../src/lib/inscricao-status'

process.env.JWT_SECRET ||= 'teste-local-jwt-secret-32-chars-min'

function ler(relativo: string) {
  return fs.readFileSync(path.join(process.cwd(), relativo), 'utf8')
}

function rotas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) return rotas(completo)
    return entrada.name === 'route.ts' ? [completo] : []
  })
}

// Inscrição automática: a flag antiga não muda mais o resultado.
assert.equal(statusInicialDaInscricao(true), 'APROVADA')
assert.equal(statusInicialDaInscricao(false), 'APROVADA')
assert.equal(statusInicialDaInscricao(null), 'APROVADA')
assert.equal(statusInicialDaInscricao(undefined), 'APROVADA')
assert.equal(statusInicialDaInscricao(), 'APROVADA')

for (const campo of LIGA_CAMPOS_OCULTOS) {
  assert.equal(LIGA_COLUNAS_PUBLICAS.split(',').includes(campo), false, campo)
}

const posse = /requireOwnedLigaForSetup|ligaDoOrganizador|exigirOrganizadorDaLiga|getOwnedLiga|organizadorId !== auth\.userId|organizador\.userId === liga\.organizadorId/
const ligas = rotas(path.join(process.cwd(), 'src/app/api/organizador/ligas'))
assert.ok(ligas.length >= 20, 'rotas de campeonato do organizador')
for (const arquivo of ligas) {
  assert.match(fs.readFileSync(arquivo, 'utf8'), posse, arquivo)
}

const inscricoes = ler('src/app/api/inscricoes-campeonato/route.ts')
assert.match(inscricoes, /statusInicialDaInscricao/)
assert.doesNotMatch(inscricoes, /status:\s*'APROVADA'/)
assert.doesNotMatch(inscricoes, /return error\([^)]*rascunhosErr/)

assert.doesNotMatch(ler('src/lib/team-registration-draft.ts'), /update\(\{ status: 'APROVADA' \}\)/)

for (const relativo of [
  'src/app/api/inscricao-rapida/route.ts',
  'src/app/api/inscricao-rapida/[token]/route.ts',
  'src/app/api/inscricao-rapida/[token]/finalizar/route.ts',
  'src/app/api/inscricao-rapida/[token]/jogadores/route.ts',
]) {
  assert.doesNotMatch(ler(relativo), /errorDetail\(/, relativo)
}

const setup = ler('src/lib/championship-setup-access.ts')
assert.doesNotMatch(setup, /return error\([^)]*ligaErr/)
assert.doesNotMatch(setup, /return error\([^)]*,\s*err\)/)

const equipes = ler('src/app/api/equipes/route.ts')
assert.doesNotMatch(equipes, /liga:Liga\(/)
assert.doesNotMatch(equipes, /jogadores:Jogador\(/)
const rankings = ler('src/app/api/rankings/route.ts')
assert.doesNotMatch(rankings, /jogador:Jogador\(/)
assert.doesNotMatch(rankings, /equipe:Equipe\(/)
assert.doesNotMatch(rankings, /cpf|documentoNumero|telefone|qrCodeToken/)

assert.match(ler('src/app/api/ligas/route.ts'), /LIGA_COLUNAS_PUBLICAS/)
assert.doesNotMatch(ler('src/app/api/ligas/route.ts'), /select\('\*'\)/)
assert.doesNotMatch(ler('src/app/api/ligas/[slug]/route.ts'), /select\('\*'\)/)
assert.match(ler('src/lib/arbitro-access.ts'), /Use o link exclusivo do jogo/)
assert.match(ler('src/app/api/arbitro/partidas/[token]/iniciar/route.ts'), /id,status,sumulaToken/)
assert.doesNotMatch(ler('src/app/api/organizador/partidas/[id]/arbitro/route.ts'), /Err\.message/)
assert.match(ler('.env.example'), /Obrigatório em produção e no preview/)
assert.doesNotMatch(ler('.env.example'), /Opcional\. Se vazio, o login administrativo/)
assert.match(ler('src/lib/use-banco-ao-vivo.ts'), /setInterval/)

async function negar(carregar: () => Promise<unknown>, metodo: 'GET' | 'POST' | 'PATCH', url: string, params: Record<string, string>) {
  const modulo = await carregar() as Record<string, (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>>
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: metodo,
    headers: { 'content-type': 'application/json' },
  }
  if (metodo !== 'GET') init.body = '{}'
  const resposta = await modulo[metodo](new NextRequest(`http://127.0.0.1:3001${url}`, init), {
    params: Promise.resolve(params),
  })
  assert.equal(resposta.status, 401, `${metodo} ${url}`)
  const json = await resposta.json() as { error?: string; details?: unknown }
  assert.equal(json.details, undefined, `${metodo} ${url}`)
  assert.match(json.error ?? '', /autorizado|link exclusivo/i, `${metodo} ${url}`)
}

async function main() {
  await negar(() => import('../src/app/api/organizador/ligas/[id]/setup/route'), 'GET', '/api/organizador/ligas/1/setup', { id: '1' })
  await negar(() => import('../src/app/api/organizador/ligas/[id]/calendario/route'), 'PATCH', '/api/organizador/ligas/1/calendario', { id: '1' })
  await negar(() => import('../src/app/api/organizador/ligas/[id]/mata-mata/route'), 'POST', '/api/organizador/ligas/1/mata-mata', { id: '1' })
  await negar(() => import('../src/app/api/organizador/partidas/[id]/arbitro/route'), 'PATCH', '/api/organizador/partidas/1/arbitro', { id: '1' })
  await negar(() => import('../src/app/api/arbitro/partidas/[token]/iniciar/route'), 'POST', '/api/arbitro/partidas/123/iniciar', { token: '123' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
