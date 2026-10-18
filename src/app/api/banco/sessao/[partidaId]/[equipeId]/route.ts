import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { respostaDeExcecao } from '@/lib/banco/acesso'
import { resolverAcessoSessao } from '@/lib/banco/sessao'
import { visaoDoBanco } from '@/lib/banco/servico'

/**
 * App de banco por sessão (R14). Mesma visão do GET /api/banco/[token], autenticada pela conta do Meu Time.
 * Desligado sem BANCO_SESSAO_ATIVO=1 + BANCO_APP_ATIVO=1 + MEU_TIME_ATIVO=1 (404). Qualquer membro da equipe lê.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ partidaId: string; equipeId: string }> }) {
  const { partidaId, equipeId } = await params
  const acesso = await resolverAcessoSessao(req, partidaId, equipeId, 'leitura')
  if (acesso instanceof Response) return acesso
  try {
    return success(await visaoDoBanco(acesso.partida, acesso.equipeId))
  } catch (e) {
    return respostaDeExcecao(e)
  }
}
