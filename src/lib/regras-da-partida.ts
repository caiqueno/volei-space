import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { regrasParaFase, type CategoryMatchRules } from '@/lib/category-match-rules'

const CAMPOS_BASE = 'setsPorPartida,pontosPorSet,tieBreakUltimoSet,pontosUltimoSet,terceiroSetObrigatorio,setsFormato'
const CAMPOS_FASE = 'setsPorPartidaFinal,setsPorPartidaSemifinal,setsPorPartidaTerceiroLugar'
const CAMPOS_COM_FASE = `${CAMPOS_BASE},${CAMPOS_FASE}`

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}

function colunaDeFaseAusente(erro: { message?: string; code?: string; details?: string } | null) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /setsPorPartida(Final|Semifinal|TerceiroLugar)|PGRST204|42703/i.test(texto)
}

async function lerSets(tabela: 'Liga' | 'CategoriaConfiguracao', coluna: 'id' | 'categoriaCampeonatoId', valor: number | string) {
  const consulta = await supabase.from(tabela).select(CAMPOS_COM_FASE).eq(coluna, valor).maybeSingle()
  if (!consulta.error) return consulta.data
  if (!colunaDeFaseAusente(consulta.error)) return null
  const base = await supabase.from(tabela).select(CAMPOS_BASE).eq(coluna, valor).maybeSingle()
  return base.data
}

function mesclar(liga: Record<string, unknown>, categoria: Record<string, unknown>) {
  const fonte: Record<string, unknown> = { ...liga }
  for (const chave of ['setsPorPartida', 'pontosPorSet', 'tieBreakUltimoSet', 'pontosUltimoSet', 'terceiroSetObrigatorio', 'setsFormato']) {
    if (categoria[chave] != null) fonte[chave] = categoria[chave]
  }
  for (const chave of ['setsPorPartidaFinal', 'setsPorPartidaSemifinal', 'setsPorPartidaTerceiroLugar']) {
    if (Object.prototype.hasOwnProperty.call(categoria, chave)) fonte[chave] = categoria[chave]
  }
  return fonte
}

/** Liga, e a categoria da partida quando ela existe. A fase entra depois, em `regrasParaFase`. */
export async function carregarFonteDeSets(partida: { ligaId?: number | null; liga?: unknown; categoriaCampeonatoId?: string | null }) {
  const embutida = (primeiro(partida.liga) ?? {}) as Record<string, unknown>
  const ligaId = Number(partida.ligaId ?? embutida.id)
  const lida = Number.isInteger(ligaId) && ligaId > 0 ? await lerSets('Liga', 'id', ligaId) : null
  const liga = { ...embutida, ...(lida ?? {}) }
  if (!partida.categoriaCampeonatoId) return liga
  const categoria = await lerSets('CategoriaConfiguracao', 'categoriaCampeonatoId', partida.categoriaCampeonatoId)
  if (!categoria) return liga
  return mesclar(liga, categoria)
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
