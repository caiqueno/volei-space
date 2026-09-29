import { error } from '@/lib/api-response'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const STATUS_CAMPEONATO_FINALIZADO = 'FINALIZADO'
export const MENSAGEM_CAMPEONATO_FINALIZADO = 'Este campeonato está finalizado e disponível apenas para consulta.'

export function isCampeonatoFinalizado(status?: string | null) {
  return String(status ?? '').trim().toUpperCase() === STATUS_CAMPEONATO_FINALIZADO
}

export function respostaCampeonatoFinalizado() {
  return error(MENSAGEM_CAMPEONATO_FINALIZADO, 409)
}

export async function rejectIfCampeonatoFinalizado(ligaId: number) {
  const { data, error: consultaErr } = await supabaseAdmin
    .from('Liga')
    .select('status')
    .eq('id', ligaId)
    .maybeSingle()

  if (consultaErr) return error('Não foi possível verificar o status do campeonato.', 500)
  if (isCampeonatoFinalizado(data?.status)) return respostaCampeonatoFinalizado()
  return null
}
