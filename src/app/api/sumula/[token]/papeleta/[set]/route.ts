import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { resolverApontador, respostaDeExcecao } from '@/lib/banco/acesso'
import { numeroDoSet, papeletasDoSet } from '@/lib/banco/servico'

/** As papeletas ENVIADAS ou ACEITAS das duas equipes no set. Mesma autenticação da súmula. */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; set: string }> }) {
  const { token, set } = await params
  const acesso = await resolverApontador(req, token)
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  if (setNumero == null) return respostaErro('Set inválido.', 400, 'DADOS_INVALIDOS')
  try {
    return await papeletasDoSet(acesso.partida, setNumero)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
