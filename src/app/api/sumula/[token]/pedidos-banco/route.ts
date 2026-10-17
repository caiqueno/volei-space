import { NextRequest } from 'next/server'
import { resolverApontador, respostaDeExcecao } from '@/lib/banco/acesso'
import { pendentesDaPartida } from '@/lib/banco/servico'

/** Pedidos do banco ainda pendentes, das duas equipes. Mesma autenticação da súmula. Desligado sem `BANCO_APP_ATIVO=1`. */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const acesso = await resolverApontador(req, token)
  if (acesso instanceof Response) return acesso
  try {
    return await pendentesDaPartida(acesso.partida)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
