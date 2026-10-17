/**
 * Tradução entre o evento do motor (`SumulaEvento`, tipos de jogo) e a linha da tabela
 * "SumulaEvento" (migration pendente 202610170023).
 *
 * A tabela limita `tipo` a um conjunto menor que o do motor (CHECK). Por isso o tipo do motor
 * vai sempre dentro do payload, na chave `_motor`, que é a fonte da verdade na leitura. A coluna
 * `tipo` guarda só a categoria mais próxima, útil para consultas e auditoria no SQL.
 * Pendência para o agente banco-de-dados: ampliar o CHECK com os tipos do motor e dispensar `_motor`.
 */
import type { NovoEvento, SumulaEvento, SumulaEventoTipo } from '@/lib/regras-volei'

export const CHAVE_TIPO_MOTOR = '_motor'

export const TIPO_NA_TABELA: Record<SumulaEventoTipo, string> = {
  SET_INICIADO: 'INICIO_SET',
  PONTO: 'PONTO',
  RALLY_REPETIDO: 'SAQUE',
  FALTA_POSICAO: 'SAQUE',
  FALTA_ROTACAO: 'SAQUE',
  TROCA_LADO: 'SAQUE',
  SUBSTITUICAO: 'SUBSTITUICAO',
  TEMPO: 'TEMPO',
  PEDIDO_INDEVIDO: 'TEMPO',
  INTERRUPCAO: 'TEMPO',
  TROCA_LIBERO: 'LIBERO',
  REDESIGNACAO_LIBERO: 'LIBERO',
  SANCAO: 'SANCAO',
  SET_ANULADO: 'FIM_SET',
  WO: 'WO',
  EQUIPE_INCOMPLETA: 'WO',
  OBSERVACAO: 'SAQUE',
  DISCREPANCIA_PAPELETA: 'SAQUE',
  CAPITAO_EM_JOGO: 'SAQUE',
  PROTESTO_ANUNCIADO: 'SAQUE',
  PROTESTO_REGISTRADO: 'SAQUE',
  PROTESTO_DESISTIDO: 'SAQUE',
  DESFAZ: 'DESFAZ',
}

export interface LinhaSumulaEvento {
  id: number
  seq: number
  clientEventId: string
  tipo: string
  setNumero: number | null
  equipeId: number | null
  payload: Record<string, unknown> | null
  desfazId: number | null
  criadoEm?: string | null
}

export const COLUNAS_LEITURA = 'id,seq,clientEventId,tipo,setNumero,equipeId,payload,desfazId,criadoEm'

/** Linhas da tabela (ordenadas por seq) para o log do motor. O DESFAZ da tabela aponta o id; o do motor, o seq. */
export function linhasParaLog(linhas: readonly LinhaSumulaEvento[]): {
  log: SumulaEvento[]
  idPorSeq: Map<number, number>
} {
  const seqPorId = new Map<number, number>()
  const idPorSeq = new Map<number, number>()
  for (const l of linhas) {
    seqPorId.set(Number(l.id), Number(l.seq))
    idPorSeq.set(Number(l.seq), Number(l.id))
  }
  const log = linhas.map((l): SumulaEvento => {
    const { [CHAVE_TIPO_MOTOR]: motor, ...payload } = (l.payload ?? {}) as Record<string, unknown>
    const base = {
      seq: Number(l.seq),
      clientEventId: String(l.clientEventId),
      desfazId: l.desfazId == null ? null : (seqPorId.get(Number(l.desfazId)) ?? null),
      ...(l.criadoEm ? { criadoEm: String(l.criadoEm) } : {}),
    }
    if (l.tipo === 'DESFAZ') return { ...base, tipo: 'DESFAZ', payload: {} }
    if (typeof motor === 'string') return { ...base, tipo: motor, payload } as SumulaEvento
    // Linha sem tipo do motor (ex.: SNAPSHOT de jogo antigo): vira observação para manter o seq contíguo.
    return { ...base, tipo: 'OBSERVACAO', payload: { texto: `Registro ${l.tipo} importado` } }
  })
  return { log, idPorSeq }
}

export interface PartidaParaEvento {
  id: number
  equipeAId: number | null
  equipeBId: number | null
}

export interface OrigemDoEvento {
  autorTipo: 'APONTADOR' | 'ARBITRO' | 'ORGANIZADOR' | 'SISTEMA'
  autorRef: string | null
  ocorridoEm?: string
}

function equipeDoEvento(novo: NovoEvento): 'A' | 'B' | null {
  const p = novo.payload as unknown as Record<string, unknown>
  const valor = p.equipe ?? p.equipeFaltosa ?? (p.ausente === 'A' || p.ausente === 'B' ? p.ausente : null)
  return valor === 'A' || valor === 'B' ? valor : null
}

/** Argumentos nomeados do RPC `registrar_evento_sumula` (assinatura real da migration pendente). */
export function argumentosDoRpc(params: {
  partida: PartidaParaEvento
  novo: NovoEvento
  /** Número do set em que o evento acontece (null fora de set). */
  setNumero: number | null
  origem: OrigemDoEvento
  seqEsperado: number
  idPorSeq: ReadonlyMap<number, number>
}) {
  const { partida, novo, setNumero, origem, seqEsperado, idPorSeq } = params
  const lado = equipeDoEvento(novo)
  const equipeId = lado === 'A' ? partida.equipeAId : lado === 'B' ? partida.equipeBId : null
  const desfazId = novo.tipo === 'DESFAZ' ? (idPorSeq.get(Number(novo.desfazId)) ?? null) : null
  return {
    p_partida_id: partida.id,
    p_client_event_id: novo.clientEventId,
    p_tipo: TIPO_NA_TABELA[novo.tipo],
    p_payload: { ...(novo.payload as object), [CHAVE_TIPO_MOTOR]: novo.tipo },
    p_autor_tipo: origem.autorTipo,
    p_autor_ref: origem.autorRef,
    p_set_numero: setNumero,
    p_equipe_id: equipeId,
    p_jogador_id: null,
    p_desfaz_id: desfazId,
    p_ocorrido_em: origem.ocorridoEm ?? null,
    p_seq_esperado: seqEsperado,
  }
}
