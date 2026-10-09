import { spawnSync } from 'node:child_process'
import path from 'node:path'

const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('Informe o arquivo para o ts-node.')
  process.exit(1)
}

const comando = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'ts-node.cmd' : 'ts-node')
const resultado = spawnSync(comando, ['-r', 'tsconfig-paths/register', script, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_PROJECT: 'tsconfig.scripts.json',
    TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'CommonJS', esModuleInterop: true }),
  },
  shell: process.platform === 'win32',
})

if (resultado.error) {
  console.error(resultado.error)
  process.exit(1)
}

process.exit(resultado.status ?? 1)
