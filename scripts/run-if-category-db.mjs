import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const file = process.argv[2]
if (!file) {
  console.error('informe o teste de categoria')
  process.exit(1)
}

function skip(motivo) {
  console.log(`SKIP ${file}: ${motivo}`)
  process.exit(0)
}

const url = process.env.DATABASE_URL?.trim()
if (!url) skip('DATABASE_URL ausente. Não usar Supabase de produção.')

let hostname = ''
try {
  hostname = new URL(url).hostname
} catch {
  console.error('DATABASE_URL inválida.')
  process.exit(1)
}
if (hostname.endsWith('supabase.co') || hostname.endsWith('supabase.com')) {
  console.error('DATABASE_URL de Supabase recusada.')
  process.exit(1)
}
if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
  console.error(`DATABASE_URL em ${hostname} recusada.`)
  process.exit(1)
}

const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' })
if (psql.error || psql.status !== 0) skip('cliente psql ausente')

let funcoes = ''
try {
  funcoes = execFileSync('psql', [
    url,
    '-t',
    '-A',
    '-c',
    "select count(*) from pg_proc where proname in ('selecionar_categorias_campeonato','salvar_configuracao_categoria')",
  ], { encoding: 'utf8' })
} catch (erro) {
  const mensagem = erro instanceof Error ? erro.message.split('\n')[0] : String(erro)
  skip(`Postgres local inacessível (${mensagem})`)
}

if (funcoes.trim() !== '2') {
  skip('RPCs de categoria ausentes neste Postgres. O schema sintético do harness não está aplicado e não será criado contra outro banco.')
}

const tsNode = createRequire(import.meta.url).resolve('ts-node/dist/bin.js')
const target = file.startsWith('scripts/') ? file : `scripts/${file}`
const result = spawnSync(process.execPath, [tsNode, '-r', 'tsconfig-paths/register', target], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)
