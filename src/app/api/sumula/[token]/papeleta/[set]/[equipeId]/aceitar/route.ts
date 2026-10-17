import { NextRequest } from 'next/server'
import { inteiroPositivo, respostaErro } from '@/lib/banco/base'
import { resolverApontador, respostaDeExcecao } from '@/lib/banco/acesso'
import { aceitarPapeleta, numeroDoSet } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** O apontador confere e aceita a papeleta enviada por uma equipe. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; set: string; equipeId: string }> }) {
  const { token, set, equipeId } = await params
  const acesso = await resolverApontador(req, token)
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  const equipe = inteiroPositivo(equipeId)
  if (setNumero == null || equipe == null) return respostaErro('Dados inválidos.', 400, 'DADOS_INVALIDOS')
  try {
    return await aceitarPapeleta(acesso.partida, acesso.usuarioId, setNumero, equipe)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
