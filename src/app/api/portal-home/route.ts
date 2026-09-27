import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { getPortalHome } from '@/lib/portal-home'

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'])
  if (auth instanceof Response) return auth

  const ligaId = new URL(req.url).searchParams.get('ligaId') ?? undefined
  const data = await getPortalHome({ organizador: auth.userId, ligaId })
  return success(data)
}
