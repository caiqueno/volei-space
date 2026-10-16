// Recria o banco LOCAL com as migrations e o seed: `npm run reset-db`.
// Nunca roda contra banco remoto: a trava de alvo-local.mjs recusa *.supabase.co e
// qualquer host que não seja 127.0.0.1/localhost. Também nunca usa --linked.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { exigirAlvoLocal } from './alvo-local.mjs'

const raiz = process.cwd()

function existe(comando, argumentos = ['--version']) {
  const resultado = spawnSync(comando, argumentos, { cwd: raiz, stdio: 'ignore', shell: process.platform === 'win32' })
  return resultado.status === 0
}

function falhar(mensagem) {
  console.error(`reset-db: ${mensagem}`)
  process.exit(1)
}

exigirAlvoLocal(process.env, raiz)

if (!existe('docker')) falhar('Docker não encontrado. Instale o Docker Desktop e deixe-o aberto.')
if (!existe('supabase')) falhar('Supabase CLI não encontrada. Instale a CLI (https://supabase.com/docs/guides/cli).')

if (!fs.existsSync(path.join(raiz, 'supabase', 'config.toml'))) {
  console.warn('Aviso: supabase/config.toml não existe. Rode `supabase init` ou traga o arquivo da branch do banco.')
}

console.log('> supabase db reset (somente banco local)')
const resultado = spawnSync('supabase', ['db', 'reset'], { cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(resultado.status ?? 1)
