import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// A trava é um módulo ESM (.mjs): o teste a executa pela linha de comando, como o setup e o reset-db fazem.
const script = path.join(process.cwd(), 'scripts', 'alvo-local.mjs')

function rodar(...urls: string[]) {
  const resultado = spawnSync(process.execPath, [script, ...urls], { encoding: 'utf8' })
  return { codigo: resultado.status, saida: `${resultado.stdout}${resultado.stderr}` }
}

// Aceita só host local.
assert.equal(rodar('postgresql://postgres:postgres@127.0.0.1:54322/postgres').codigo, 0)
assert.equal(rodar('http://localhost:54321').codigo, 0)
assert.equal(rodar('http://127.0.0.1:54321', 'postgresql://postgres:postgres@localhost:54322/postgres').codigo, 0)

// Recusa Supabase remoto (API, banco direto e pooler), host qualquer, valor vazio ou ilegível.
for (const remoto of [
  'https://abcdefgh.supabase.co',
  'postgresql://postgres:senha-secreta@db.abcdefgh.supabase.co:5432/postgres',
  'postgresql://postgres.abcdefgh:senha-secreta@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
  'https://meu-servidor.exemplo.com',
  'host-sem-protocolo',
  '',
]) {
  assert.equal(rodar(remoto).codigo, 1, `deveria recusar: ${remoto.slice(0, 30)}`)
}

// Basta uma URL remota entre várias para recusar tudo.
assert.equal(rodar('http://127.0.0.1:54321', 'https://abcdefgh.supabase.co').codigo, 1)

// A mensagem nunca imprime URL, usuário nem senha.
const recusa = rodar('postgresql://postgres:senha-secreta@db.abcdefgh.supabase.co:5432/postgres')
assert.equal(recusa.codigo, 1)
assert.ok(!recusa.saida.includes('senha-secreta'), 'a senha vazou na saída')
assert.ok(!recusa.saida.includes('abcdefgh'), 'o host vazou na saída')

console.log('alvo-local ok')
