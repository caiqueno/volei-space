import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { MENSAGEM_SUMULA_SEM_TIMES, timesDefinidos } from '@/lib/vaga-a-definir'
import {
  configDaPartida,
  contextoDaPartida,
  lerEstado,
  loteSchema,
  processarLote,
  sumulaEventosAtivo,
  type ClienteEventos,
  type EntradaPartida,
} from '@/lib/sumula-eventos'

/**
 * Súmula por eventos (J02). Rota NOVA, desligada por padrão: responde 404 sem `SUMULA_EVENTOS_ATIVO=1`.
 * O fluxo atual da súmula (api/sumula/[token]) não passa por aqui. Ver docs/analise/07-arquitetura-backend.md.
 */
export const dynamic = 'force-dynamic'

const cliente = supabaseAdmin as unknown as ClienteEventos

function desligada() {
  return error('Recurso não encontrado.', 404)
}

async function montarEntrada(partida: any): Promise<EntradaPartida> {
  const regras = await regrasEfetivasDaPartida(partida)
  return {
    partida: { id: Number(partida.id), equipeAId: partida.equipeAId ?? null, equipeBId: partida.equipeBId ?? null },
    config: configDaPartida(regras),
    contexto: contextoDaPartida(partida),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!sumulaEventosAtivo()) return desligada()
  const { token } = await params

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura

  const apartir = Number(new URL(req.url).searchParams.get('apartirDeSeq') ?? 0)
  const aPartirDeSeq = Number.isInteger(apartir) && apartir > 0 ? apartir : 0

  try {
    const resultado = await lerEstado(cliente, await montarEntrada(access.partida), aPartirDeSeq)
    if (resultado.tipo === 'INDISPONIVEL') return error(resultado.mensagem, 503)
    if (resultado.tipo === 'ERRO') return error(resultado.mensagem, 500)
    return success({ estado: resultado.estado, eventos: resultado.eventos })
  } catch {
    return error('Não foi possível ler os eventos da súmula.', 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!sumulaEventosAtivo()) return desligada()
  const { token } = await params

  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access
  const partida = access.partida
  if (!timesDefinidos(partida)) return error(MENSAGEM_SUMULA_SEM_TIMES, 422)
  const bloqueio = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
  if (bloqueio) return bloqueio

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return error('Corpo da requisição inválido.', 400)
  }
  const lote = loteSchema.safeParse(corpo)
  if (!lote.success) return error('Dados inválidos', 422, lote.error.flatten())

  try {
    const resultado = await processarLote(cliente, await montarEntrada(partida), lote.data, {
      autorTipo: access.auth.tipo === 'organizador' ? 'ORGANIZADOR' : 'ARBITRO',
      autorRef: String(access.auth.userId),
    })
    switch (resultado.tipo) {
      case 'INDISPONIVEL':
        return error(resultado.mensagem, 503)
      case 'ERRO':
        return error(resultado.mensagem, 500)
      case 'CONFLITO':
        return error('A súmula mudou desde a última leitura. Atualize o estado e reenvie.', 409, {
          codigo: 'RG-LOG-010',
          seqAtual: resultado.seqAtual,
          aceitos: resultado.aceitos,
          estado: resultado.estado,
        })
      case 'PROCESSADO':
        return success({ aceitos: resultado.aceitos, rejeitados: resultado.rejeitados, estado: resultado.estado })
    }
  } catch {
    return error('Não foi possível registrar os eventos da súmula.', 500)
  }
}
