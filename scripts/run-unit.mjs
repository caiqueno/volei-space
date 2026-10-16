import { readdirSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const raiz = process.cwd()
const pasta = path.join(raiz, 'scripts')

function descobrir(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) descobrir(caminho, acc)
    else if (/\.test\.(ts|mjs)$/.test(nome)) acc.push(caminho)
  }
  return acc
}

function usaHarnessDeCategoria(arquivo) {
  if (!arquivo.endsWith('.ts')) return false
  const texto = readFileSync(arquivo, 'utf8')
  return /from\s+['"][^'"]*category-test-database['"]/.test(texto)
}

function relativo(arquivo) {
  return path.relative(raiz, arquivo).split(path.sep).join('/')
}

const arquivos = descobrir(pasta).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
if (arquivos.length === 0) {
  console.error('nenhum teste em scripts/**/*.test.(ts|mjs)')
  process.exit(1)
}

for (const arquivo of arquivos) {
  const rel = relativo(arquivo)
  const comando = usaHarnessDeCategoria(arquivo)
    ? ['scripts/run-if-category-db.mjs', rel]
    : arquivo.endsWith('.mjs')
      ? [rel]
      : ['scripts/with-ts-node.mjs', rel]
  const resultado = spawnSync(process.execPath, comando, { stdio: 'inherit' })
  if (resultado.error) {
    console.error(resultado.error)
    process.exit(1)
  }
  if (resultado.status !== 0) process.exit(resultado.status ?? 1)
}
