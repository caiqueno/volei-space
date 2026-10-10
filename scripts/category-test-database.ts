import { execFileSync } from 'node:child_process'
import path from 'node:path'

function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL ausente. Este harness não lê .env nem usa Supabase.')
  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error('DATABASE_URL inválida.')
  }
  if (hostname.endsWith('supabase.co') || hostname.endsWith('supabase.com')) {
    throw new Error('DATABASE_URL de Supabase recusada.')
  }
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    throw new Error(`DATABASE_URL em ${hostname} recusada. Use o Postgres local de teste.`)
  }
  return url
}

export function sql(query: string) {
  return execFileSync('psql', [databaseUrl(), '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', query], {
    encoding: 'utf8',
  })
}

export function migration(filename: string) {
  if (filename.includes('/') || filename.includes('\\') || !filename.endsWith('.sql')) {
    throw new Error('migration espera só o nome do arquivo em supabase/migrations.')
  }
  const full = path.resolve(__dirname, '../supabase/migrations', filename)
  execFileSync('psql', [databaseUrl(), '-v', 'ON_ERROR_STOP=1', '-f', full], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
}
