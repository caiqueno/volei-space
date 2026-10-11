import { clearTokenCookie, lerEstadoGestao, renovarCookieGestao } from '@/lib/auth'
import { error, success } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST() {
  const estado = await lerEstadoGestao()
  if (estado.estado === 'expirada') {
    const res = error('Sessão expirada.', 401)
    const cookie = clearTokenCookie()
    res.cookies.set(cookie.name, cookie.value, cookie.options)
    return res
  }
  if (estado.estado !== 'valida') return error('Não autorizado.', 401)

  const cookie = await renovarCookieGestao(estado)
  const res = success({ ok: true })
  res.cookies.set(cookie.name, cookie.value, cookie.options)
  return res
}
