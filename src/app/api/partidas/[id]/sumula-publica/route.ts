import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { semCacheCompartilhado } from '@/lib/cache-publico'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { anexarNumerosHerdados } from '@/lib/numero-herdado-leitura'
import { PARTIDA_CONSULTA_COLUNAS, sumulaParaConsulta } from '@/lib/sumula-consulta'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Leitura pública, somente leitura, da súmula de uma partida de campeonato
 * publicado. É o único caminho público por id numérico: /api/sumula/{token}
 * não aceita mais Partida.id como credencial.
 * A resposta é a projeção de consulta (sem documento, telefone, nascimento ou token).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d{1,9}$/.test(id)) return naoEncontrada()

  const { data, error: leituraErr } = await supabase
    .from('Partida')
    .select(PARTIDA_CONSULTA_COLUNAS)
    .eq('id', Number(id))
    .maybeSingle()
  const partida = data as any

  if (leituraErr) {
    console.error('[sumula-publica] erro ao ler partida', leituraErr)
    return semCacheCompartilhado(error('Não foi possível abrir a súmula.', 500))
  }
  const liga = Array.isArray(partida?.liga) ? partida?.liga[0] : partida?.liga
  if (!partida || !campeonatoPublicado(liga)) return naoEncontrada()

  await anexarNumerosHerdados(partida as never)
  return semCacheCompartilhado(success(sumulaParaConsulta(partida)))
}

function naoEncontrada() {
  return semCacheCompartilhado(error('Partida não encontrada.', 404))
}
