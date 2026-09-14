import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_PREFIX = '/admin'
const LOGIN_PATH = '/admin/login'
const OFFICIAL_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@luv.com.br').trim().toLowerCase()
const NOINDEX_PREFIXES = [
  '/admin',
  '/cadastro',
  '/painel',
  '/capitao',
  '/inscricao',
  '/inscricao-rapida',
  '/resetar-senha',
  '/sumula',
  '/arbitro',
  '/ficha',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith(ADMIN_PREFIX) || pathname === LOGIN_PATH) {
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
    '/cadastro/:path*',
    '/painel/:path*',
    '/capitao/:path*',
    '/inscricao/:path*',
    '/inscricao-rapida/:path*',
    '/resetar-senha/:path*',
    '/sumula/:path*',
    '/arbitro/:path*',
    '/ficha/:path*',
  ],
}
