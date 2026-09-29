import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { controlarPartida, limparSimulacao, painelSimulacao, recriarSimulacao } from '@/lib/simulacao-dados'

function ambienteBloqueado() {
  if (process.env.NODE_ENV === 'production') {
    return error('A central de simulações fica disponível só no ambiente de desenvolvimento.', 403)
  }
  return null
}

export async function GET(req: NextRequest) {
  const bloqueio = ambienteBloqueado()
  if (bloqueio) return bloqueio
  const auth = await requireAuth(req)
  if (auth) return auth
  try {
    return success(await painelSimulacao())
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Não foi possível carregar a simulação.'
    return error(mensagem, 500)
  }
}

export async function POST(req: NextRequest) {
  const bloqueio = ambienteBloqueado()
  if (bloqueio) return bloqueio
  const auth = await requireAuth(req)
  if (auth) return auth

  const body = await req.json().catch(() => null) as { acao?: string; partidaId?: number; velocidade?: number } | null
  const acao = body?.acao
  try {
    if (acao === 'recriar') {
      await recriarSimulacao()
      return success(await painelSimulacao())
    }
    if (acao === 'limpar') {
      const resultado = await limparSimulacao()
      return success({ ...resultado, ...(await painelSimulacao()) })
    }
    if (!body?.partidaId || !['pausar', 'retomar', 'iniciar', 'encerrar', 'avancar'].includes(acao ?? '')) {
      return error('Ação de simulação inválida.', 422)
    }
    await controlarPartida(body.partidaId, acao as 'pausar' | 'retomar' | 'iniciar' | 'encerrar' | 'avancar', body.velocidade)
    return success(await painelSimulacao())
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Não foi possível atualizar a simulação.'
    return error(mensagem, 500)
  }
}

export const dynamic = 'force-dynamic'
