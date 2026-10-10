import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { montarFonteDeRegras, regrasParaFase, type CategoryMatchRules } from '@/lib/category-match-rules'

// `terceiroSetObrigatorio` existe só em CategoriaConfiguracao. Pedi-lo na Liga
// faz o PostgREST recusar a leitura inteira e a súmula cai no default da Liga.
const CAMPOS_LIGA = 'setsPorPartida,pontosPorSet,tieBreakUltimoSet,pontosUltimoSet,setsFormato'
const CAMPOS_CATEGORIA = `${CAMPOS_LIGA},terceiroSetObrigatorio`
const CAMPOS_FASE = 'setsPorPartidaFinal,setsPorPartidaSemifinal,setsPorPartidaTerceiroLugar'

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}

function colunaDeFaseAusente(erro: { message?: string; code?: string; details?: string } | null) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /setsPorPartida(Final|Semifinal|TerceiroLugar)|PGRST204|42703/i.test(texto)
}

async function lerLinha(tabela: 'Liga' | 'CategoriaConfiguracao', campos: string, coluna: string, valor: number | string) {
  const comFase = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE}`).eq(coluna, valor).maybeSingle()
  if (!comFase.error) return comFase.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comFase.error)) throw new Error(comFase.error.message)
  const base = await supabase.from(tabela).select(campos).eq(coluna, valor).maybeSingle()
  if (base.error) throw new Error(base.error.message)
  return base.data as Record<string, unknown> | null
}

/** Categoria da partida, quando existe. Sem ela, as colunas de sets da Liga. */
export async function carregarFonteDeSets(partida: { ligaId?: number | null; liga?: unknown; categoriaCampeonatoId?: string | null }) {
  if (partida.categoriaCampeonatoId) {
    const categoria = await lerLinha('CategoriaConfiguracao', CAMPOS_CATEGORIA, 'categoriaCampeonatoId', partida.categoriaCampeonatoId)
    if (categoria) return montarFonteDeRegras({ categoria })
  }
  const embutida = (primeiro(partida.liga) ?? {}) as Record<string, unknown>
  const ligaId = Number(partida.ligaId ?? embutida.id)
  const lida = Number.isInteger(ligaId) && ligaId > 0
    ? await lerLinha('Liga', CAMPOS_LIGA, 'id', ligaId)
    : null
  return montarFonteDeRegras({ liga: { ...embutida, ...(lida ?? {}) } })
}

export async function regrasEfetivasDaPartida(partida: {
  ligaId?: number | null
  liga?: unknown
  categoriaCampeonatoId?: string | null
  fase?: string | null
}): Promise<CategoryMatchRules> {
  const fonte = await carregarFonteDeSets(partida)
  return regrasParaFase(fonte, partida.fase)
}
