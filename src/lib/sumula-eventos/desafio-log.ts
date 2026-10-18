/**
 * Registro da decisão de um desafio de vídeo no log da súmula (R13), como evento DESAFIO.
 *
 * É só REGISTRO: o evento não altera placar, rotação nem repete rally. Qualquer consequência no jogo
 * (ponto, rally repetido) é decisão da arbitragem e é lançada à parte. Ver docs/analise/27-desafio-video.md.
 * Falha ao registrar nunca pode impedir a decisão: a função devolve o motivo e quem chama só registra em log.
 */
import { createHash } from 'node:crypto'
import { processarLote, type EntradaPartida } from './lote'
import type { ClienteEventos } from './repositorio'
import type { OrigemDoEvento } from './mapeamento'

const eventosAtivos = (env: Record<string, string | undefined>) => env.SUMULA_EVENTOS_ATIVO === '1'

export const RESULTADOS_NO_LOG = ['MANTIDA', 'REVERTIDA', 'INCONCLUSIVA', 'CANCELADO'] as const
export type ResultadoNoLog = (typeof RESULTADOS_NO_LOG)[number]

export type DesafioParaLog = { id: string; setNumero: number; equipeId: number; estado: string }

/** UUID determinístico (formato v5) a partir do id do desafio: o mesmo desafio gera sempre o mesmo clientEventId. */
export function clientEventIdDoDesafio(desafioId: string): string {
  const h = createHash('sha1').update(`desafio:${desafioId.toLowerCase()}`).digest()
  h[6] = (h[6]! & 0x0f) | 0x50
  h[8] = (h[8]! & 0x3f) | 0x80
  const hex = h.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export type ResultadoRegistroDesafio =
  | { tipo: 'REGISTRADO'; duplicado: boolean }
  | { tipo: 'IGNORADO'; motivo: 'FLAG_DESLIGADA' | 'ESTADO_NAO_FINAL' | 'EQUIPE_FORA_DA_PARTIDA' }
  | { tipo: 'FALHOU'; motivo: string }

export async function registrarDecisaoDesafioNoLog(
  cliente: ClienteEventos,
  entrada: EntradaPartida,
  desafio: DesafioParaLog,
  origem: OrigemDoEvento,
  env: Record<string, string | undefined> = process.env,
): Promise<ResultadoRegistroDesafio> {
  if (!eventosAtivos(env)) return { tipo: 'IGNORADO', motivo: 'FLAG_DESLIGADA' }
  const resultado = RESULTADOS_NO_LOG.find((r) => r === desafio.estado)
  if (!resultado) return { tipo: 'IGNORADO', motivo: 'ESTADO_NAO_FINAL' }
  const equipe = Number(desafio.equipeId) === entrada.partida.equipeAId ? 'A' : Number(desafio.equipeId) === entrada.partida.equipeBId ? 'B' : null
  if (!equipe) return { tipo: 'IGNORADO', motivo: 'EQUIPE_FORA_DA_PARTIDA' }
  const lote = {
    eventos: [
      {
        clientEventId: clientEventIdDoDesafio(desafio.id),
        tipo: 'DESAFIO' as const,
        payload: { equipe, setNumero: Number(desafio.setNumero), resultado, desafioId: desafio.id.toLowerCase() },
      },
    ],
  }
  try {
    // Sem seqEsperado: se outro lance entrar no meio (CONFLITO), relê o log e tenta de novo.
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const r = await processarLote(cliente, entrada, lote, origem)
      if (r.tipo === 'PROCESSADO') {
        if (r.rejeitados.length > 0) return { tipo: 'FALHOU', motivo: r.rejeitados[0]!.codigo }
        return { tipo: 'REGISTRADO', duplicado: r.aceitos[0]?.duplicado === true }
      }
      if (r.tipo !== 'CONFLITO') return { tipo: 'FALHOU', motivo: r.tipo }
    }
    return { tipo: 'FALHOU', motivo: 'CONFLITO' }
  } catch {
    return { tipo: 'FALHOU', motivo: 'EXCECAO' }
  }
}
