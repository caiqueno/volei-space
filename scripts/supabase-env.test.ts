import assert from 'node:assert/strict'
import { lerConfiguracaoSupabase } from '../src/lib/supabase-env'

const dev = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'publishable-dev',
  NEXT_PUBLIC_SUPABASE_ALVO: 'desenvolvimento',
  SUPABASE_HOSTS_PROIBIDOS: 'prod.supabase.co',
}

const prod = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'publishable-prod',
  NEXT_PUBLIC_SUPABASE_ALVO: 'producao',
  NEXT_PUBLIC_VERCEL_ENV: 'production',
  SUPABASE_HOSTS_PROIBIDOS: 'dev.supabase.co,antigo.supabase.co',
}

assert.equal(lerConfiguracaoSupabase({}).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_SUPABASE_URL: '' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_SUPABASE_ALVO: '' }).ok, false)

const local = lerConfiguracaoSupabase(dev)
assert.equal(local.ok, true)
if (local.ok) assert.equal(local.producao, false)

assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_SUPABASE_ALVO: 'producao' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_ALVO: 'producao' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...prod, NEXT_PUBLIC_SUPABASE_ALVO: 'desenvolvimento' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...dev, NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...prod, NEXT_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...prod, NEXT_PUBLIC_SUPABASE_URL: 'https://antigo.supabase.co' }).ok, false)

const publicado = lerConfiguracaoSupabase(prod)
assert.equal(publicado.ok, true)
if (publicado.ok) {
  assert.equal(publicado.producao, true)
  assert.equal(publicado.url, 'https://prod.supabase.co')
}

// --- Supabase local: só em desenvolvimento, alvo desenvolvimento e fora da Vercel ---
const localDev = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chave-local',
  NEXT_PUBLIC_SUPABASE_ALVO: 'desenvolvimento',
  NODE_ENV: 'development',
}
assert.equal(lerConfiguracaoSupabase(localDev).ok, true)
assert.equal(lerConfiguracaoSupabase({ ...localDev, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }).ok, true)
assert.equal(lerConfiguracaoSupabase({ ...localDev, NODE_ENV: 'production' }).ok, false, 'local recusado fora de development')
assert.equal(lerConfiguracaoSupabase({ ...localDev, NODE_ENV: undefined }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...localDev, NEXT_PUBLIC_SUPABASE_ALVO: 'producao' }).ok, false)
assert.equal(lerConfiguracaoSupabase({ ...localDev, VERCEL_ENV: 'preview' }).ok, false, 'local recusado na Vercel')
assert.equal(lerConfiguracaoSupabase({ ...localDev, NEXT_PUBLIC_SUPABASE_URL: 'https://127.0.0.1:54321' }).ok, false, 'local exige http')
assert.equal(lerConfiguracaoSupabase({ ...localDev, NEXT_PUBLIC_SUPABASE_URL: 'http://user:senha@127.0.0.1:54321' }).ok, false, 'credencial na URL')
assert.equal(lerConfiguracaoSupabase({ ...localDev, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1.evil.com' }).ok, false, 'host que só parece local')

// --- DATABASE_URL / DIRECT_URL precisam apontar para o mesmo ambiente da API ---
const bancoDireto = (ref: string) => `postgresql://postgres:senha-secreta@db.${ref}.supabase.co:5432/postgres`
const bancoPooler = (ref: string) => `postgresql://postgres.${ref}:senha-secreta@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
const devRef = { ...dev, NEXT_PUBLIC_SUPABASE_URL: 'https://projdev.supabase.co' }
assert.equal(lerConfiguracaoSupabase({ ...devRef, DIRECT_URL: bancoDireto('projdev'), DATABASE_URL: bancoPooler('projdev') }).ok, true)
assert.equal(lerConfiguracaoSupabase({ ...devRef }).ok, true, 'ausentes são ignoradas')
assert.equal(lerConfiguracaoSupabase({ ...devRef, DATABASE_URL: 'postgresql://...' }).ok, true, 'modelo do .env.example é ignorado')
assert.equal(lerConfiguracaoSupabase({ ...devRef, DATABASE_URL: 'isto não é uma URL' }).ok, true, 'ilegível é ignorada')
assert.equal(lerConfiguracaoSupabase({ ...devRef, DATABASE_URL: 'postgresql://u:p@banco.interno.exemplo:5432/x' }).ok, true, 'host não classificável é ignorado')

const outroProjeto = lerConfiguracaoSupabase({ ...devRef, DIRECT_URL: bancoDireto('projprod') })
assert.equal(outroProjeto.ok, false)
assert.equal(lerConfiguracaoSupabase({ ...devRef, DATABASE_URL: bancoPooler('projprod') }).ok, false, 'pooler de outro projeto')
assert.equal(lerConfiguracaoSupabase({ ...devRef, DIRECT_URL: 'postgresql://postgres:p@127.0.0.1:54322/postgres' }).ok, false, 'banco local com API remota')
assert.equal(lerConfiguracaoSupabase({ ...localDev, DATABASE_URL: bancoDireto('projprod') }).ok, false, 'API local com banco remoto')
assert.equal(lerConfiguracaoSupabase({ ...localDev, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }).ok, true)

// A mensagem de erro nunca traz a URL, o host nem a senha.
if (!outroProjeto.ok) {
  assert.ok(!outroProjeto.erro.includes('senha-secreta'))
  assert.ok(!outroProjeto.erro.includes('projprod'))
  assert.match(outroProjeto.erro, /DIRECT_URL/)
}

console.log('supabase-env ok')
