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
const HOSTS_LOCAIS = ['127.0.0.1', 'localhost']
const SUFIXO_SUPABASE = '.supabase.co'

function ambienteAtual(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ALVO: process.env.NEXT_PUBLIC_SUPABASE_ALVO,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SUPABASE_HOSTS_PROIBIDOS: process.env.SUPABASE_HOSTS_PROIBIDOS,
    NODE_ENV: process.env.NODE_ENV,
    // Só existem no servidor e na CLI. No navegador ficam indefinidas e a conferência é ignorada.
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  }
}

function lerUrl(valor: string | undefined) {
  const texto = valor?.trim()
  if (!texto) return null
  try {
    return new URL(texto)
  } catch {
    return null
  }
}

/** Ref do projeto Supabase: `<ref>.supabase.co` (API) ou `db.<ref>.supabase.co` (banco direto). */
function refDoHost(host: string) {
  if (!host.endsWith(SUFIXO_SUPABASE)) return null
  const nome = host.slice(0, -SUFIXO_SUPABASE.length)
  return nome.startsWith('db.') ? nome.slice('db.'.length) : nome
}

/** No pooler o ref vem no usuário: `postgres.<ref>`. */
function refDoUsuarioDoPooler(usuario: string) {
  const texto = decodeURIComponent(usuario)
  const ponto = texto.indexOf('.')
  return ponto >= 0 ? texto.slice(ponto + 1).toLowerCase() : null
}

/**
 * Confere que DATABASE_URL e DIRECT_URL (Prisma e migrations) apontam para o MESMO ambiente
 * da API (NEXT_PUBLIC_SUPABASE_URL): banco local com API local, e projeto remoto com o mesmo ref.
 * Valor ausente, ilegível ou de host que não dá para classificar é ignorado: só barra
 * divergência comprovada. A mensagem cita o NOME da variável e nunca a URL nem a senha.
 */
export function validarBancoMesmoProjeto(env: Env, hostDaApi: string): string | null {
  const hostname = hostDaApi.split(':')[0].toLowerCase()
  const apiLocal = HOSTS_LOCAIS.includes(hostname)
  const refApi = refDoHost(hostname)

  for (const nome of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const banco = lerUrl(env[nome])
    if (!banco || (banco.protocol !== 'postgresql:' && banco.protocol !== 'postgres:')) continue
    const hostBanco = banco.hostname.toLowerCase()
    const bancoLocal = HOSTS_LOCAIS.includes(hostBanco)

    if (apiLocal && !bancoLocal) return `${nome} não é local, mas NEXT_PUBLIC_SUPABASE_URL é local. Os dois precisam apontar para o mesmo ambiente.`
    if (!apiLocal && bancoLocal) return `${nome} é local, mas NEXT_PUBLIC_SUPABASE_URL aponta para um projeto remoto. Os dois precisam apontar para o mesmo ambiente.`
    if (apiLocal || !refApi) continue

    const refBanco = refDoHost(hostBanco) ?? (hostBanco.endsWith('.pooler.supabase.com') ? refDoUsuarioDoPooler(banco.username) : null)
    if (refBanco && refBanco !== refApi) return `${nome} aponta para outro projeto Supabase que não é o de NEXT_PUBLIC_SUPABASE_URL.`
  }
  return null
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
    // Supabase local (CLI): só em desenvolvimento, alvo desenvolvimento e fora da Vercel.
    const hostLocal = HOSTS_LOCAIS.includes(parsed.hostname.toLowerCase())
    if (hostLocal) {
      const permitido = env.NODE_ENV === 'development' && alvo === 'desenvolvimento' && !deploy
      if (!permitido || parsed.protocol !== 'http:' || parsed.username || parsed.password) {
        return { ok: false, erro: 'Supabase local só é aceito com NODE_ENV=development, alvo desenvolvimento e fora da Vercel.' }
      }
    } else if (parsed.protocol !== 'https:' || !host.endsWith(SUFIXO_SUPABASE)) {
      return { ok: false, erro: 'NEXT_PUBLIC_SUPABASE_URL inválida.' }
    }
  } catch {
    return { ok: false, erro: 'NEXT_PUBLIC_SUPABASE_URL inválida.' }
  }

  const erroBanco = validarBancoMesmoProjeto(env, host)
  if (erroBanco) return { ok: false, erro: erroBanco }

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
