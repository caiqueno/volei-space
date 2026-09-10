import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access

  return success({
    ...access.partida,
    janelaValidacao: getJanelaValidacao(access.partida.dataHora),
  })
}

function getJanelaValidacao(dataHora?: string | null) {
  if (!dataHora) {
    return { liberada: true, mensagem: 'Partida sem horario definido. Validacao liberada para teste.' }
  }

  const abreEm = new Date(dataHora).getTime() - 60 * 60 * 1000
  return {
    liberada: true,
    abreEm: new Date(abreEm).toISOString(),
    mensagem: 'Validacao por QR Code liberada para teste operacional.',
  }
}
