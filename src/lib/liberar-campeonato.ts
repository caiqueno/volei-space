import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

/**
 * Grava `pagamentoConfirmadoEm` sem criar cobrança nem chamar a InfinitePay.
 * As funções SQL de grupos e mata-mata exigem essa coluna. Não há migration:
 * o carimbo é o que faz o gate existente deixar passar.
 */
export async function liberarCampeonatoSemCobranca(
  ligaId: number,
): Promise<{ ok: true; pagamentoConfirmadoEm: string } | { ok: false }> {
  const agora = new Date().toISOString()
  const { data, error: updateErr } = await supabase
    .from('Liga')
    .update({ pagamentoConfirmadoEm: agora })
    .eq('id', ligaId)
    .is('pagamentoConfirmadoEm', null)
    .select('pagamentoConfirmadoEm')
    .maybeSingle()

  if (updateErr) {
    console.error('[pagamento] não foi possível liberar o campeonato sem cobrança', updateErr)
    return { ok: false }
  }
  if (data?.pagamentoConfirmadoEm) return { ok: true, pagamentoConfirmadoEm: data.pagamentoConfirmadoEm }

  const { data: atual, error: leituraErr } = await supabase
    .from('Liga')
    .select('pagamentoConfirmadoEm')
    .eq('id', ligaId)
    .maybeSingle()
  if (leituraErr || !atual?.pagamentoConfirmadoEm) {
    if (leituraErr) console.error('[pagamento] leitura após liberar o campeonato', leituraErr)
    return { ok: false }
  }
  return { ok: true, pagamentoConfirmadoEm: atual.pagamentoConfirmadoEm }
}
