import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { respostaDeExcecao } from '@/lib/banco/acesso'
import { resolverAcessoSessao } from '@/lib/banco/sessao'
import { lerCorpo, numeroDoSet, salvarRascunho } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Salva o rascunho da papeleta pela sessão (RESPONSAVEL ou TECNICO), com a mesma validação do link por token. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ partidaId: string; equipeId: string; set: string }> }) {
  const { partidaId, equipeId, set } = await params
  const acesso = await resolverAcessoSessao(req, partidaId, equipeId, 'papeleta')
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  if (setNumero == null) return respostaErro('Set inválido.', 400, 'DADOS_INVALIDOS')
  try {
    return await salvarRascunho(acesso.partida, acesso.equipeId, setNumero, await lerCorpo(req))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
