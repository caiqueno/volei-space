import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { consultarComVaga } from '@/lib/consulta-vaga'
import {
  PARTIDA_OPERACAO_BASE_COLUNAS,
  PARTIDA_OPERACAO_EMBEDS,
  PARTIDA_SUMULA_EMBEDS,
} from '@/lib/projecoes-publicas'

// Leitura da partida para quem opera a súmula (árbitro, organizador, link do jogo).
// Todas as colunas são explícitas: sem CPF, documento, nascimento, telefone, e-mail
// nem organizadorId. A posse do campeonato é checada por organizadorDaLiga.

export type FiltroPartida = { coluna: 'id'; valor: number } | { coluna: 'sumulaToken'; valor: string }

export const SELECAO_PARTIDA_OPERACAO = `${PARTIDA_OPERACAO_BASE_COLUNAS},${PARTIDA_OPERACAO_EMBEDS}`
export const SELECAO_PARTIDA_SUMULA = `${PARTIDA_OPERACAO_BASE_COLUNAS},${PARTIDA_SUMULA_EMBEDS}`

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor
}

/** O PostgREST devolve embeds de 1 linha como objeto ou lista; as rotas esperam objeto. */
export function normalizarRelacoes(partida: any) {
  if (!partida) return partida
  partida.liga = primeiro(partida.liga)
  partida.equipeA = primeiro(partida.equipeA)
  partida.equipeB = primeiro(partida.equipeB)
  return partida
}

async function lerPartida(selecao: string, filtro: FiltroPartida) {
  const { data, error } = await consultarComVaga(selecao, (colunas) => (
    supabase.from('Partida').select(colunas).eq(filtro.coluna, filtro.valor).maybeSingle()
  ))
  return { partida: normalizarRelacoes(data), error }
}

export function lerPartidaOperacao(filtro: FiltroPartida) {
  return lerPartida(SELECAO_PARTIDA_OPERACAO, filtro)
}

export function lerPartidaSumula(filtro: FiltroPartida) {
  return lerPartida(SELECAO_PARTIDA_SUMULA, filtro)
}

/** Dono do campeonato, lido à parte para o organizadorId não viajar dentro da partida. */
export async function organizadorDaLiga(ligaId: number): Promise<string | null> {
  if (!Number.isInteger(Number(ligaId))) return null
  const { data } = await supabase.from('Liga').select('id,organizadorId').eq('id', Number(ligaId)).maybeSingle()
  return data?.organizadorId ?? null
}
