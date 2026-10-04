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

console.log('supabase-env ok')
