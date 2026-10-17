import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { resolverAcessoBanco, respostaDeExcecao } from '@/lib/banco/acesso'
import { visaoDoBanco } from '@/lib/banco/servico'

/** App de banco (R9). Desligado sem `BANCO_APP_ATIVO=1` (404). Sem dados pessoais: só nome e camisa. */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const acesso = await resolverAcessoBanco(req, token)
  if (acesso instanceof Response) return acesso
  try {
    return success(await visaoDoBanco(acesso.partida, acesso.equipeId))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
