import { NextRequest, NextResponse } from 'next/server'
import { consumirLimiteAsync, ipDaRequisicao } from '@/lib/rate-limit'
import { entradaViaMeuTimeAtiva, resolverEntradaInscricao } from '@/lib/inscricao-entrada/resolver'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store' }
// Mesma resposta para token inexistente, revogado, desativado, expirado ou de campeonato não publicado.
const INVALIDO = 'Link inválido ou indisponível. Peça um novo link ao organizador.'

// GET /api/inscricao/entrada/[token]: porta de entrada dos links legados (categoria, campeonato, vaga) para o Meu Time.
// Pública, sem PII, com limite por IP. Atrás de INSCRICAO_VIA_MEU_TIME_ATIVO=1 (desligada = 404).
export async function GET(req: NextRequest, argumentos: { params: { token: string } | Promise<{ token: string }> }) {
  if (!entradaViaMeuTimeAtiva()) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404, headers: SEM_CACHE })

  const limite = await consumirLimiteAsync(`inscricao-entrada:ip:${ipDaRequisicao(req)}`, 30, 60_000, 'FECHADO')
  if (!limite.ok) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um instante.' },
      { status: 429, headers: { ...SEM_CACHE, 'Retry-After': String(Math.max(1, limite.retryAfterSeconds)) } },
    )
  }

  try {
    const { token } = await Promise.resolve(argumentos.params)
    const entrada = await resolverEntradaInscricao(token)
    if (!entrada) return NextResponse.json({ error: INVALIDO }, { status: 404, headers: SEM_CACHE })
    return NextResponse.json({ data: entrada }, { status: 200, headers: SEM_CACHE })
  } catch (erro) {
    console.error('[inscricao-entrada] falha', erro instanceof Error ? erro.message : 'desconhecido')
    return NextResponse.json({ error: 'Não foi possível concluir a operação. Tente novamente.' }, { status: 500, headers: SEM_CACHE })
  }
}
