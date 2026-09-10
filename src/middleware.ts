import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_PREFIX = '/admin'
const LOGIN_PATH = '/admin/login'
const OFFICIAL_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@luv.com.br').trim().toLowerCase()

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith(ADMIN_PREFIX) || pathname === LOGIN_PATH) {
    return NextResponse.next()
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
    return NextResponse.next()
  } catch {
    return redirectToLogin(req)
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
