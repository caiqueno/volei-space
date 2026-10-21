// Web Push SEM payload (R18). O servidor só "toca a campainha": o service worker (public/sw.js) mostra um texto fixo
// e abre /meu-time/notificacoes. Nada de dado pessoal trafega pelo serviço de push.
// Autenticação VAPID (RFC 8292): JWT ES256 assinado com `node:crypto`, sem dependência nova.
//   VAPID_PUBLIC_KEY  : chave pública não comprimida (65 bytes) em base64url.
//   VAPID_PRIVATE_KEY : escalar privado (32 bytes) em base64url.
//   VAPID_SUBJECT     : mailto: ou https: de contato.
import { createPrivateKey, sign } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { MENSAGEM_CANAIS_NAO_HABILITADO } from './flags'

const db = supabaseAdmin as any

const base64url = (entrada: Buffer | string) => Buffer.from(entrada).toString('base64url')

export function vapidConfigurado(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)
}

export function chavePublicaVapid(env: Record<string, string | undefined> = process.env) {
  return env.VAPID_PUBLIC_KEY?.trim() || null
}

/** JWT VAPID para o `aud` (origem do endpoint). Expira em até 12 h (limite do RFC é 24 h). */
export function assinarJwtVapid(audiencia: string, agoraMs = Date.now(), env: Record<string, string | undefined> = process.env) {
  const publica = Buffer.from(String(env.VAPID_PUBLIC_KEY ?? ''), 'base64url')
  const privada = Buffer.from(String(env.VAPID_PRIVATE_KEY ?? ''), 'base64url')
  if (publica.length !== 65 || publica[0] !== 4 || privada.length !== 32 || !env.VAPID_SUBJECT) {
    throw new Error('VAPID_NAO_CONFIGURADO')
  }
  const chave = createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64url(publica.subarray(1, 33)),
      y: base64url(publica.subarray(33, 65)),
      d: base64url(privada),
    },
  })
  const cabecalho = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const corpo = base64url(JSON.stringify({ aud: audiencia, exp: Math.floor(agoraMs / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT }))
  const assinatura = sign('sha256', Buffer.from(`${cabecalho}.${corpo}`), { key: chave, dsaEncoding: 'ieee-p1363' })
  return `${cabecalho}.${corpo}.${base64url(assinatura)}`
}

export type AssinaturaPush = { id?: string; endpoint: string }
export type ResultadoPush = { ok: true } | { ok: false; status: number | null; remover: boolean; erro: string }

/** Envia o "toque" sem corpo. 404 e 410 significam assinatura morta: o chamador a remove. */
export async function enviarPushSemPayload(
  assinatura: AssinaturaPush,
  buscar: typeof fetch = fetch,
  agoraMs = Date.now(),
  env: Record<string, string | undefined> = process.env,
): Promise<ResultadoPush> {
  let jwt: string
  try {
    jwt = assinarJwtVapid(new URL(assinatura.endpoint).origin, agoraMs, env)
  } catch {
    return { ok: false, status: null, remover: false, erro: 'VAPID_NAO_CONFIGURADO' }
  }
  try {
    const resposta = await buscar(assinatura.endpoint, {
      method: 'POST',
      headers: { Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`, TTL: '3600', Urgency: 'normal', 'Content-Length': '0' },
      cache: 'no-store',
    })
    if (resposta.ok) return { ok: true }
    const remover = resposta.status === 404 || resposta.status === 410
    return { ok: false, status: resposta.status, remover, erro: `HTTP_${resposta.status}` }
  } catch {
    return { ok: false, status: null, remover: false, erro: 'REDE' }
  }
}

// --- Assinaturas do usuário -----------------------------------------------------------

const ENDERECO_PRIVADO = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i

export const assinaturaPushSchema = z.object({
  endpoint: z.string().trim().min(10).max(2000).refine((valor) => {
    try {
      const url = new URL(valor)
      return url.protocol === 'https:' && !url.username && !url.password && !ENDERECO_PRIVADO.test(url.hostname)
    } catch {
      return false
    }
  }, 'endpoint inválido'),
  chaves: z.object({
    p256dh: z.string().trim().regex(/^[A-Za-z0-9_-]{60,120}$/, 'chave inválida'),
    auth: z.string().trim().regex(/^[A-Za-z0-9_-]{16,40}$/, 'chave inválida'),
  }),
})
export const cancelarPushSchema = z.object({ endpoint: z.string().trim().min(10).max(2000) })

function indisponivel() {
  return new ErroMeuTime(MENSAGEM_CANAIS_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

function conferir(resultado: { error: { code?: string | null } | null }, onde: string) {
  if (!resultado.error) return
  if (tabelaAusente(resultado.error) || resultado.error.code === '42703') throw indisponivel()
  console.error(`[notificacoes-canais] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

/** Idempotente por endpoint. O endpoint é único: assinar de novo no mesmo aparelho só troca o dono e as chaves. */
export async function assinarPush(usuarioId: string, entrada: z.infer<typeof assinaturaPushSchema>) {
  const dados = { usuarioId, chaveP256dh: entrada.chaves.p256dh, chaveAuth: entrada.chaves.auth, ultimoErro: null }
  const existente = await db.from('PushAssinatura').select('id').eq('endpoint', entrada.endpoint).maybeSingle()
  conferir(existente, 'ler assinatura push')
  if (existente.data) {
    conferir(await db.from('PushAssinatura').update(dados).eq('endpoint', entrada.endpoint), 'atualizar assinatura push')
  } else {
    const criada = await db.from('PushAssinatura').insert({ endpoint: entrada.endpoint, ...dados })
    if (violacaoUnica(criada.error)) {
      conferir(await db.from('PushAssinatura').update(dados).eq('endpoint', entrada.endpoint), 'atualizar assinatura push')
    } else conferir(criada, 'criar assinatura push')
  }
  return { assinado: true }
}

/** Remove só a assinatura do próprio usuário; assinatura inexistente ou de outro usuário continua 200. */
export async function cancelarPush(usuarioId: string, endpoint: string) {
  conferir(await db.from('PushAssinatura').delete().eq('endpoint', endpoint).eq('usuarioId', usuarioId), 'remover assinatura push')
  return { assinado: false }
}
