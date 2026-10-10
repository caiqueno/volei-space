import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { montarFonteDeRegras, regrasParaFase, type CategoryMatchRules } from '@/lib/category-match-rules'
import { CAMPOS_SETS_POR_FASE_ANTERIORES, CAMPOS_SETS_QUARTAS_OITAVAS } from '@/lib/sets-por-fase'

// `terceiroSetObrigatorio` existe só em CategoriaConfiguracao. Pedi-lo na Liga
// faz o PostgREST recusar a leitura inteira e a súmula cai no default da Liga.
const CAMPOS_LIGA = 'setsPorPartida,pontosPorSet,tieBreakUltimoSet,pontosUltimoSet,setsFormato'
const CAMPOS_CATEGORIA = `${CAMPOS_LIGA},terceiroSetObrigatorio`
const CAMPOS_FASE = CAMPOS_SETS_POR_FASE_ANTERIORES.join(',')
const CAMPOS_FASE_NOVA = CAMPOS_SETS_QUARTAS_OITAVAS.join(',')
const CAMPO_LIMITE = 'limiteSubstituicoesPorSet'
const CAMPO_RODIZIO = 'alertaRodizioIlegal'
const CAMPOS_TEMPOS = 'limiteTemposPorSet,separarTempos'
const CAMPOS_LESAO = 'tempoMedico,substituicaoPorLesao'
const CAMPOS_LIBERO = 'exigirLiberoInicial,quantidadeLiberos'

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}

function colunaDeFaseAusente(erro: { message?: string; code?: string; details?: string } | null) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /setsPorPartida(Final|Semifinal|Quartas|Oitavas|TerceiroLugar)|limiteSubstituicoesPorSet|alertaRodizioIlegal|limiteTemposPorSet|separarTempos|tempoMedico|substituicaoPorLesao|exigirLiberoInicial|quantidadeLiberos|PGRST204|42703/i.test(texto)
}

async function lerLinha(tabela: 'Liga' | 'CategoriaConfiguracao', campos: string, coluna: string, valor: number | string) {
  const comLibero = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO},${CAMPOS_TEMPOS},${CAMPOS_LESAO},${CAMPOS_LIBERO}`).eq(coluna, valor).maybeSingle()
  if (!comLibero.error) return comLibero.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comLibero.error)) throw new Error(comLibero.error.message)
  // O líbero configurável ainda não existe em produção. A leitura seguinte mantém lesão, tempos, alerta, limite e fases.
  const comLesao = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO},${CAMPOS_TEMPOS},${CAMPOS_LESAO}`).eq(coluna, valor).maybeSingle()
  if (!comLesao.error) return comLesao.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comLesao.error)) throw new Error(comLesao.error.message)
  // Lesão ainda não existe em produção. A leitura seguinte mantém os tempos, o alerta, o limite e as fases.
  const comTempos = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO},${CAMPOS_TEMPOS}`).eq(coluna, valor).maybeSingle()
  if (!comTempos.error) return comTempos.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comTempos.error)) throw new Error(comTempos.error.message)
  // Os tempos ainda não existem em produção. A leitura seguinte mantém o alerta, o limite e as fases.
  const completa = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE},${CAMPO_RODIZIO}`).eq(coluna, valor).maybeSingle()
  if (!completa.error) return completa.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(completa.error)) throw new Error(completa.error.message)
  // O alerta ainda não existe em produção. A leitura seguinte mantém o limite e as fases.
  const comLimite = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA},${CAMPO_LIMITE}`).eq(coluna, valor).maybeSingle()
  if (!comLimite.error) return comLimite.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comLimite.error)) throw new Error(comLimite.error.message)
  // O limite ainda não existe em produção. A leitura seguinte mantém quartas e oitavas.
  const comQuartas = await supabase.from(tabela).select(`${campos},${CAMPOS_FASE},${CAMPOS_FASE_NOVA}`).eq(coluna, valor).maybeSingle()
  if (!comQuartas.error) return comQuartas.data as Record<string, unknown> | null
  if (!colunaDeFaseAusente(comQuartas.error)) throw new Error(comQuartas.error.message)
  // Quartas e oitavas ainda não existem em produção. A leitura seguinte mantém final, semifinal e 3º lugar.
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
