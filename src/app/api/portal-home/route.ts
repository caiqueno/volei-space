import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { getPainelInicio, getPortalHome } from '@/lib/portal-home'

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'])
  if (auth instanceof Response) return auth

  const params = new URL(req.url).searchParams
  if (params.get('visao') === 'painel') {
    return success({ slides: await getPainelInicio(auth.userId) })
  }
  const ligaId = params.get('ligaId') ?? undefined
  const data = await getPortalHome({ organizador: auth.userId, ligaId })
  return success(data)
}
