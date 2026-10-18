import { NextRequest } from 'next/server'
import { respostaErro } from '@/lib/banco/base'
import { respostaDeExcecao } from '@/lib/banco/acesso'
import { resolverAcessoSessao } from '@/lib/banco/sessao'
import { enviarPapeleta, numeroDoSet } from '@/lib/banco/servico'

export const dynamic = 'force-dynamic'

/** Envia (e trava) a papeleta do set pela sessão (RESPONSAVEL ou TECNICO). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ partidaId: string; equipeId: string; set: string }> }) {
  const { partidaId, equipeId, set } = await params
  const acesso = await resolverAcessoSessao(req, partidaId, equipeId, 'papeleta')
  if (acesso instanceof Response) return acesso
  const setNumero = numeroDoSet(set)
  if (setNumero == null) return respostaErro('Set inválido.', 400, 'DADOS_INVALIDOS')
  try {
    return await enviarPapeleta(acesso.partida, acesso.equipeId, setNumero)
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
