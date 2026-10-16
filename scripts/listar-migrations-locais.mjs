// Inventário local das migrations. Não abre banco e não chama a CLI.
// Serve para comparar com o resultado de scripts/consultar-historico-migrations.sql.

import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'supabase', 'migrations')
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()

console.log('versao\tdigitos\tarquivo\tefeito')
for (const name of files) {
  const version = name.slice(0, name.indexOf('_'))
  const source = fs.readFileSync(path.join(dir, name), 'utf8')
  const efeito = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('--') && line.replace(/^--\s*/, '').length > 0)
    ?.replace(/^--\s*/, '')
    .replace(/\s+/g, ' ')
    ?? ''
  console.log(`${version}\t${version.length}\t${name}\t${efeito}`)
}
