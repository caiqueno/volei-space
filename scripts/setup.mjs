// Prepara o ambiente local: `npm run setup`.
// Faz: confere o Node contra .nvmrc, instala dependências, cria o .env.local a partir do
// .env.example (sem sobrescrever e sem imprimir valores) e gera o Prisma Client.
// NÃO sobe Docker nem Supabase: só IMPRIME os comandos do Supabase CLI local.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const raiz = process.cwd()
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function falhar(mensagem) {
  console.error(`setup: ${mensagem}`)
  process.exit(1)
}

function executar(comando, argumentos) {
  console.log(`> ${comando} ${argumentos.join(' ')}`)
  const resultado = spawnSync(comando, argumentos, { cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32' })
  if (resultado.status !== 0) falhar(`o comando "${comando} ${argumentos.join(' ')}" falhou.`)
}

// 1. Versão do Node
const arquivoNvm = path.join(raiz, '.nvmrc')
if (fs.existsSync(arquivoNvm)) {
  const exigida = Number(fs.readFileSync(arquivoNvm, 'utf8').trim().replace(/^v/, '').split('.')[0])
  const atual = Number(process.versions.node.split('.')[0])
  if (Number.isFinite(exigida) && atual !== exigida) {
    falhar(`o projeto usa Node ${exigida} (.nvmrc) e você está no Node ${atual}. Troque a versão e rode de novo.`)
  }
}

// 2. Dependências
executar(npm, ['ci'])

// 3. .env.local sem sobrescrever e sem imprimir valores
const exemplo = path.join(raiz, '.env.example')
const destino = path.join(raiz, '.env.local')
if (fs.existsSync(destino)) {
  console.log('.env.local já existe: mantido como está.')
} else if (fs.existsSync(exemplo)) {
  fs.copyFileSync(exemplo, destino)
  console.log('.env.local criado a partir do .env.example. Preencha os valores do seu ambiente de DESENVOLVIMENTO.')
} else {
  falhar('.env.example não encontrado.')
}

// 4. Prisma Client
executar(npx, ['prisma', 'generate'])

// 5. Banco local: só instruções
console.log('')
console.log('Próximos passos (banco local, opcional; exige Docker Desktop e a Supabase CLI):')
console.log('  supabase start')
console.log('  npm run reset-db')
console.log('  npm run dev')
console.log('Sem banco local, use o projeto Supabase de DESENVOLVIMENTO no .env.local. Nunca o de produção.')
