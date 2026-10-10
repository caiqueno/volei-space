import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.log('SKIP postgres-servico: DATABASE_URL ausente')
  process.exit(0)
}

let hostname = ''
try {
  hostname = new URL(url).hostname
} catch {
  console.error('DATABASE_URL inválida.')
  process.exit(1)
}
if (hostname.endsWith('supabase.co') || hostname.endsWith('supabase.com') || !['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  console.error(`DATABASE_URL em ${hostname} recusada. O teste só fala com Postgres local.`)
  process.exit(1)
}

const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' })
if (psql.error || psql.status !== 0) {
  console.log('SKIP postgres-servico: cliente psql ausente')
  process.exit(0)
}

const out = execFileSync('psql', [url, '-t', '-A', '-c', 'select 1'], { encoding: 'utf8' })
assert.equal(out.trim(), '1')
console.log('postgres-servico ok')
