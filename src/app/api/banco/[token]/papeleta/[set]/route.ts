import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { resolverAcessoBanco, respostaDeExcecao } from '@/lib/banco/acesso'
import { lerCorpo, numeroDoSet, salvarRascunho } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Salva o rascunho da papeleta da equipe do token, validando com o motor de regras. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string; set: string }> }) {
  const { token, set } = await params
  const acesso = await resolverAcessoBanco(req, token)
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  if (setNumero == null) return respostaErro('Set inválido.', 400, 'DADOS_INVALIDOS')
  try {
    return await salvarRascunho(acesso.partida, acesso.equipeId, setNumero, await lerCorpo(req))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
