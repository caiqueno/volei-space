import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_PREFIX = '/admin'
const LOGIN_PATH = '/login'
const OFFICIAL_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@luv.com.br').trim().toLowerCase()
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

  if (pathname === '/painel' || pathname.startsWith('/painel/')) {
    const aguardandoTroca = await organizerMustReplacePassword(req)
    if (aguardandoTroca) {
      const url = req.nextUrl.clone()
      url.pathname = '/trocar-senha'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return nextResponse(pathname)
  }

  const token = req.cookies.get('luva_token')?.value
  if (!token) return redirectToLogin(req)

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return redirectToLogin(req)
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    if (String(payload.email ?? '').trim().toLowerCase() !== OFFICIAL_ADMIN_EMAIL) {
      return redirectToLogin(req)
    }
    return nextResponse(pathname)
  } catch {
    return redirectToLogin(req)
  }
}

async function organizerMustReplacePassword(req: NextRequest) {
  const token = req.cookies.get('luva_token')?.value
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return (payload.tipo === 'organizador' || payload.tipo === 'arbitro') && payload.trocarSenha === true
  } catch {
    return false
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.searchParams.set('next', req.nextUrl.pathname)
  const response = NextResponse.redirect(url)
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
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
