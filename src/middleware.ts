import { NextRequest, NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/admin-access'
import { classificarCookieGestao, clearTokenCookie, setTokenCookie } from '@/lib/cookie-gestao'
import { sessaoGestaoExpirada } from '@/lib/sessao-gestao'
import { lerToken } from '@/lib/token-verify'

const ADMIN_PREFIX = '/admin'
const LOGIN_PATH = '/login'
const NOINDEX_PREFIXES = [
  '/admin',
  '/login',
  '/cadastro',
  '/painel',
  '/capitao',
  '/inscricao',
  '/inscricao-rapida',
  '/resetar-senha',
  '/trocar-senha',
  '/sumula',
  '/arbitro',
  '/ficha',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/admin/login') {
    const url = req.nextUrl.clone()
    url.pathname = LOGIN_PATH
    const next = url.searchParams.get('next')
    if (!next?.startsWith('/admin') || next.startsWith('/admin/login')) {
      url.searchParams.delete('next')
    }
    return NextResponse.redirect(url)
  }

  if (pathname === '/cadastro' && req.nextUrl.searchParams.get('modo') === 'login') {
    const url = req.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (pathname === '/painel' || pathname.startsWith('/painel/') || pathname === '/trocar-senha') {
    const token = req.cookies.get('luva_token')?.value
    if (token && classificarCookieGestao(token) === 'expirada') {
      return redirectToLogin(req, true)
    }
    if (pathname === '/trocar-senha') return nextResponse(pathname)

    const aguardandoTroca = await organizerMustReplacePassword(req)
    if (aguardandoTroca) {
      const url = req.nextUrl.clone()
      url.pathname = '/trocar-senha'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return await respostaComCookieDeNavegador(pathname, token)
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return nextResponse(pathname)
  }

  const token = req.cookies.get('luva_token')?.value
  if (!token) return redirectToLogin(req)

  const payload = await lerToken<Record<string, unknown>>(token, 'admin')
  if (!payload || !isAdminSession(payload) || sessaoGestaoExpirada(payload)) {
    return redirectToLogin(req, classificarCookieGestao(token) === 'expirada')
  }
  return await respostaComCookieDeNavegador(pathname, token)
}

async function organizerMustReplacePassword(req: NextRequest) {
  const token = req.cookies.get('luva_token')?.value
  if (!token) return false
  const payload = await lerToken<{ tipo?: unknown; trocarSenha?: unknown }>(token, 'public')
  if (!payload) return false
  return (payload.tipo === 'organizador' || payload.tipo === 'arbitro') && payload.trocarSenha === true
}

function redirectToLogin(req: NextRequest, limparGestao = false) {
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.searchParams.set('next', req.nextUrl.pathname)
  if (limparGestao) url.searchParams.set('sessao', 'expirada')
  const response = NextResponse.redirect(url)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  if (limparGestao) {
    const cookie = clearTokenCookie()
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
  return response
}

async function respostaComCookieDeNavegador(pathname: string, token?: string) {
  const response = nextResponse(pathname)
  if (!token || classificarCookieGestao(token) !== 'valida') return response
  const organizador = await lerToken<{ tipo?: unknown }>(token, 'public')
  const admin = await lerToken<Record<string, unknown>>(token, 'admin')
  const gestao = organizador?.tipo === 'organizador' || Boolean(admin && isAdminSession(admin))
  if (!gestao) return response
  const cookie = setTokenCookie(token, 'navegador')
  response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<NextResponse['cookies']['set']>[2])
  return response
}

function nextResponse(pathname: string) {
  const response = NextResponse.next()
  if (NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }
  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/cadastro',
    '/cadastro/:path*',
    '/painel',
    '/painel/:path*',
    '/trocar-senha',
    '/capitao/:path*',
    '/inscricao/:path*',
    '/inscricao-rapida/:path*',
    '/resetar-senha/:path*',
    '/sumula/:path*',
    '/arbitro/:path*',
    '/ficha/:path*',
  ],
}
