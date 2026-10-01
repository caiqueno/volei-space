import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'

export const COOKIE_ACESSO_ARBITRO = 'luva_acesso_arbitro'
const LIMITE_TENTATIVAS = 5
const BLOQUEIO_MS = 15 * 60 * 1000
const SESSAO_SEGUNDOS = 60 * 60 * 8

export type AcessoArbitro = {
  id: string
  partidaId: number
  token: string
  codigoHash: string
  ativo: boolean
  tentativasFalhas: number
  bloqueadoAte: string | null
  revogadoEm: string | null
}

type CookiePayload = {
  purpose: 'acesso-arbitro'
  acessoId: string
  partidaId: number
  token: string
}

function segredo() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(secret)
}

export function novoTokenAcesso() {
  return randomBytes(16).toString('hex')
}

export function caminhoAcessoArbitro(token: string) {
  return `/arbitro/jogo/${token}`
}

export async function hashCodigoAcesso(codigo: string) {
  return bcrypt.hash(codigo, 10)
}

export function codigosConferem(codigo: string, confirmar: string) {
  const a = codigo.trim()
  const b = confirmar.trim()
  return a.length >= 4 && a.length <= 32 && a === b
}

export async function registrarEventoAcesso(entrada: {
  partidaId: number
  acessoId?: string | null
  tipo: 'LINK_GERADO' | 'CODIGO_ALTERADO' | 'LINK_REGENERADO' | 'LINK_REVOGADO' | 'ACESSO_REALIZADO' | 'CODIGO_INCORRETO'
  organizadorId?: string | null
  resultado: 'ok' | 'negado'
}) {
  await supabase.from('AcessoArbitroEvento').insert({
    partidaId: entrada.partidaId,
    acessoId: entrada.acessoId ?? null,
    tipo: entrada.tipo,
    organizadorId: entrada.organizadorId ?? null,
    resultado: entrada.resultado,
  })
}

export async function partidaDoOrganizador(req: NextRequest, partidaId: number) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth
  if (!Number.isInteger(partidaId)) return error('Partida inválida.', 400)

  const { data, error: partidaErr } = await supabase
    .from('Partida')
    .select('id,ligaId,status,dataHora,localNome,equipeA:Equipe!Partida_equipeAId_fkey(nome),equipeB:Equipe!Partida_equipeBId_fkey(nome),liga:Liga!Partida_ligaId_fkey(id,organizadorId,nome)')
    .eq('id', partidaId)
    .maybeSingle()

  if (partidaErr || !data) return error('Partida não encontrada.', 404)
  const liga = Array.isArray(data.liga) ? data.liga[0] : data.liga
  if (!liga || liga.organizadorId !== auth.userId) return error('Acesso negado para esta partida.', 403)
  return { auth, partida: data }
}

export function resumoAcesso(acesso: { token: string; ativo: boolean; revogadoEm: string | null } | null) {
  if (!acesso) return { status: 'SEM_LINK' as const, caminho: null }
  if (!acesso.ativo || acesso.revogadoEm) return { status: 'REVOGADO' as const, caminho: null }
  return { status: 'ATIVO' as const, caminho: caminhoAcessoArbitro(acesso.token) }
}

export async function gravarSessaoAcesso(acesso: Pick<AcessoArbitro, 'id' | 'partidaId' | 'token'>) {
  const token = await new SignJWT({
    purpose: 'acesso-arbitro',
    acessoId: acesso.id,
    partidaId: acesso.partidaId,
    token: acesso.token,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSAO_SEGUNDOS}s`)
    .sign(segredo())

  return {
    name: COOKIE_ACESSO_ARBITRO,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSAO_SEGUNDOS,
      path: '/',
    },
  }
}

export async function lerSessaoAcesso(req: NextRequest): Promise<CookiePayload | null> {
  const valor = req.cookies.get(COOKIE_ACESSO_ARBITRO)?.value
  if (!valor) return null
  try {
    const { payload } = await jwtVerify(valor, segredo())
    if (payload.purpose !== 'acesso-arbitro') return null
    const partidaId = Number(payload.partidaId)
    if (!Number.isInteger(partidaId) || typeof payload.acessoId !== 'string' || typeof payload.token !== 'string') return null
    return { purpose: 'acesso-arbitro', acessoId: payload.acessoId, partidaId, token: payload.token }
  } catch {
    return null
  }
}

export function bloqueioTentativas(acesso: Pick<AcessoArbitro, 'tentativasFalhas' | 'bloqueadoAte'>, agora = Date.now()) {
  if (!acesso.bloqueadoAte) return null
  const ate = new Date(acesso.bloqueadoAte).getTime()
  if (Number.isNaN(ate) || ate <= agora) return null
  return error('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429)
}

export function proximoBloqueio(tentativas: number) {
  if (tentativas < LIMITE_TENTATIVAS) return { tentativasFalhas: tentativas, bloqueadoAte: null }
  return { tentativasFalhas: tentativas, bloqueadoAte: new Date(Date.now() + BLOQUEIO_MS).toISOString() }
}

export async function codigoConfere(codigo: string, hash: string) {
  return bcrypt.compare(codigo.trim(), hash)
}

export function respostaAcesso(corpo: unknown, status: number, cookie?: { name: string; value: string; options: object }) {
  const resposta = status >= 400 ? error(String((corpo as { error?: string }).error ?? corpo), status) : success(corpo)
  if (cookie) {
    resposta.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<NextResponse['cookies']['set']>[2])
  }
  return resposta
}
