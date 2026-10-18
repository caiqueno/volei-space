import { NextRequest } from 'next/server'
import { respostaDeExcecao } from '@/lib/banco/acesso'
import { resolverAcessoSessao } from '@/lib/banco/sessao'
import { criarPedido, lerCorpo } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Pedido de tempo ou substituição pela sessão (RESPONSAVEL, TECNICO ou ASSISTENTE); fica PENDENTE até o apontador decidir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ partidaId: string; equipeId: string }> }) {
  const { partidaId, equipeId } = await params
  const acesso = await resolverAcessoSessao(req, partidaId, equipeId, 'pedido')
  if (acesso instanceof Response) return acesso
  try {
    return await criarPedido(acesso.partida, acesso.equipeId, await lerCorpo(req))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
