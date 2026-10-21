import { createHash, randomBytes } from 'crypto'
import { normalizarEmail, verificarErroDeBanco } from './config'
import type { ClienteDb } from './perfis'

export const COOKIE_PKCE = 'volei_google_pkce'
export const PKCE_MAX_AGE_SEGUNDOS = 10 * 60

export type ConfigSupabaseAuth = { url: string; anonKey: string }

export function lerConfigSupabaseAuth(env: Record<string, string | undefined> = process.env): ConfigSupabaseAuth | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey || env.GOOGLE_LOGIN_ATIVO !== '1') return null
  return { url, anonKey }
}

export const MENSAGEM_GOOGLE_INDISPONIVEL =
  'Entrada com Google ainda não está configurada neste ambiente (provedor Google no Supabase Auth e GOOGLE_LOGIN_ATIVO=1).'

function base64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function gerarPkce() {
  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function urlDeAutorizacao(config: ConfigSupabaseAuth, redirectTo: string, challenge: string) {
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    code_challenge: challenge,
    code_challenge_method: 's256',
  })
  return `${config.url}/auth/v1/authorize?${params.toString()}`
}

export type UsuarioGoogle = { email: string; sub: string }

export type ResultadoTrocaGoogle =
  | { tipo: 'ok'; usuario: UsuarioGoogle }
  | { tipo: 'nao-verificado' }
  | { tipo: 'falha' }

/** Extrai o usuário Google da resposta do Supabase Auth. Só vale com email_verified === true. */
export function usuarioGoogleDaResposta(corpo: any): ResultadoTrocaGoogle {
  const usuario = corpo?.user
  const identidade = Array.isArray(usuario?.identities)
    ? usuario.identities.find((i: any) => i?.provider === 'google')
    : null
  const email = normalizarEmail(String(usuario?.email ?? identidade?.identity_data?.email ?? ''))
  const sub = String(identidade?.identity_data?.sub ?? identidade?.id ?? usuario?.user_metadata?.sub ?? '')
  if (!usuario || !email || !sub) return { tipo: 'falha' }
  const verificado = identidade
    ? identidade.identity_data?.email_verified === true
    : usuario.user_metadata?.email_verified === true
  if (!verificado) return { tipo: 'nao-verificado' }
  return { tipo: 'ok', usuario: { email, sub } }
}

export async function trocarCodigoGoogle(
  config: ConfigSupabaseAuth,
  codigo: string,
  verifier: string,
  buscar: typeof fetch = fetch,
): Promise<ResultadoTrocaGoogle> {
  const resposta = await buscar(`${config.url}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.anonKey },
    body: JSON.stringify({ auth_code: codigo, code_verifier: verifier }),
    cache: 'no-store',
  })
  if (!resposta.ok) return { tipo: 'falha' }
  return usuarioGoogleDaResposta(await resposta.json().catch(() => null))
}

export type ResultadoVinculo = { tipo: 'ok' } | { tipo: 'conflito' }

/** Liga o sub do Google ao e-mail na primeira vez; depois exige que continue o mesmo e-mail. */
export async function vincularIdentidade(db: ClienteDb, usuario: UsuarioGoogle): Promise<ResultadoVinculo> {
  const busca = await db.from('IdentidadeExterna').select('emailNormalizado').eq('provedor', 'GOOGLE').eq('subExterno', usuario.sub).limit(1)
  verificarErroDeBanco(busca.error)
  const existente = Array.isArray(busca.data) && busca.data.length > 0 ? busca.data[0] : null
  if (existente) {
    return normalizarEmail(String(existente.emailNormalizado)) === usuario.email ? { tipo: 'ok' } : { tipo: 'conflito' }
  }
  const criado = await db.from('IdentidadeExterna').insert({
    emailNormalizado: usuario.email,
    provedor: 'GOOGLE',
    subExterno: usuario.sub,
    criadoEm: new Date().toISOString(),
  })
  verificarErroDeBanco(criado.error)
  return { tipo: 'ok' }
}
