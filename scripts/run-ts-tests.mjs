import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('informe ao menos um arquivo de teste')
  process.exit(1)
}

const tsNode = createRequire(import.meta.url).resolve('ts-node/dist/bin.js')

for (const file of files) {
  const target = file.startsWith('scripts/') ? file : `scripts/${file}`
  const result = spawnSync(process.execPath, [tsNode, '-r', 'tsconfig-paths/register', target], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
