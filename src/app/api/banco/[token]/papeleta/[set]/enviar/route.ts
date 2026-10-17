import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { resolverAcessoBanco, respostaDeExcecao } from '@/lib/banco/acesso'
import { enviarPapeleta, numeroDoSet } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Envia (e trava) a papeleta do set: só se estiver válida e antes do início do set. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; set: string }> }) {
  const { token, set } = await params
  const acesso = await resolverAcessoBanco(req, token)
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  if (setNumero == null) return respostaErro('Set inválido.', 400, 'DADOS_INVALIDOS')
  try {
    return await enviarPapeleta(acesso.partida, acesso.equipeId, setNumero)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
