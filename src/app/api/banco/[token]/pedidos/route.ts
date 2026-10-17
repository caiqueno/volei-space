import { NextRequest } from 'next/server'
import { resolverAcessoBanco, respostaDeExcecao } from '@/lib/banco/acesso'
import { criarPedido, lerCorpo } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Pedido de tempo ou substituição da equipe do token (fica PENDENTE até o apontador decidir). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const acesso = await resolverAcessoBanco(req, token)
  if (acesso instanceof Response) return acesso
  try {
    return await criarPedido(acesso.partida, acesso.equipeId, await lerCorpo(req))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
