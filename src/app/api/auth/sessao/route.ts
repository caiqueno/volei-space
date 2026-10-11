import { clearTokenCookie, lerEstadoGestao } from '@/lib/auth'
import { error, success } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET() {
  const estado = await lerEstadoGestao()
  if (estado.estado === 'valida') {
    const nome = estado.perfil === 'admin' ? estado.nome : estado.payload.nome
    const email = estado.perfil === 'admin' ? estado.email : estado.payload.email
    return success({ tipo: estado.perfil, nome, email })
  }
  if (estado.estado === 'expirada') {
    const res = error('Sessão expirada.', 401)
    const cookie = clearTokenCookie()
    res.cookies.set(cookie.name, cookie.value, cookie.options)
    return res
  }
  return error('Não autorizado.', 401)
}
