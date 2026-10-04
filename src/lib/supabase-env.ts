import type { SupabaseClient } from '@supabase/supabase-js'

export type AlvoSupabase = 'producao' | 'desenvolvimento'

export type ConfiguracaoSupabase =
  | {
      ok: true
      url: string
      anonKey: string
      alvo: AlvoSupabase
      producao: boolean
    }
  | {
      ok: false
      erro: string
    }

type Env = Record<string, string | undefined>

const VARIAVEIS = 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e NEXT_PUBLIC_SUPABASE_ALVO'

function ambienteAtual(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ALVO: process.env.NEXT_PUBLIC_SUPABASE_ALVO,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SUPABASE_HOSTS_PROIBIDOS: process.env.SUPABASE_HOSTS_PROIBIDOS,
  }
}

export function lerConfiguracaoSupabase(env: Env = ambienteAtual()): ConfiguracaoSupabase {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  const alvo = env.NEXT_PUBLIC_SUPABASE_ALVO?.trim() ?? ''
  const deploy = (env.NEXT_PUBLIC_VERCEL_ENV || env.VERCEL_ENV || '').trim()

  if (!url || !anonKey || !alvo) {
    return {
      ok: false,
      erro: `Configuração do Supabase ausente. Defina ${VARIAVEIS} no ambiente, sem valor reserva.`,
    }
  }

  if (alvo !== 'producao' && alvo !== 'desenvolvimento') {
    return { ok: false, erro: 'NEXT_PUBLIC_SUPABASE_ALVO deve ser producao ou desenvolvimento.' }
  }

  let host = ''
  try {
    const parsed = new URL(url)
    host = parsed.host.toLowerCase()
    if (parsed.protocol !== 'https:' || !host.endsWith('.supabase.co')) {
      return { ok: false, erro: 'NEXT_PUBLIC_SUPABASE_URL inválida.' }
    }
  } catch {
    return { ok: false, erro: 'NEXT_PUBLIC_SUPABASE_URL inválida.' }
  }

  const deployProducao = deploy === 'production'
  if (deployProducao && alvo !== 'producao') {
    return { ok: false, erro: 'O deploy da main só pode usar o banco de produção.' }
  }
  if (!deployProducao && alvo !== 'desenvolvimento') {
    return { ok: false, erro: 'Este ambiente não pode usar o banco de produção.' }
  }

  const proibidos = (env.SUPABASE_HOSTS_PROIBIDOS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (proibidos.includes(host)) {
    return { ok: false, erro: 'Este ambiente está apontando para um banco Supabase que não lhe pertence.' }
  }

  return {
    ok: true,
    url,
    anonKey,
    alvo,
    producao: alvo === 'producao',
  }
}

export function lerChaveServicoSupabase(env: Env = { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }) {
  return env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

export function clienteSupabaseIndisponivel(mensagem: string): SupabaseClient {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return undefined
      return new Proxy(function clienteIndisponivel() {}, handler)
    },
    apply() {
      throw new Error(mensagem)
    },
  }
  return new Proxy(function clienteIndisponivel() {}, handler) as SupabaseClient
}
