import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { CategoryScopeError, getCategoryConfiguration } from '@/lib/category-scope'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import type { SetupIntent } from '@/lib/championship-setup-status'

const ALLOWED: Record<string, string[]> = {
  estrutura: ['quantidadeEquipes', 'quantidadeEquipesMinima', 'quantidadeEquipesMaxima', 'formato', 'quantidadeGrupos', 'turnoReturno', 'setsFormato', 'setsPorPartida', 'pontosPorSet', 'diferencaMinimaSet', 'tieBreakUltimoSet', 'pontosUltimoSet', 'terceiroSetObrigatorio', 'sumulaScoutsEnabled'],
  classificacao: ['criteriosClassificacao', 'classificadosPorGrupo', 'melhoresClassificadosGerais', 'pontosVencedorMargem1', 'pontosPerdedorMargem1', 'pontosVencedorMargem2', 'pontosPerdedorMargem2'],
  eliminatorias: ['faseEliminatoria', 'metodoChaveamento', 'eliminatoriaIdaVolta', 'disputaTerceiroLugar', 'goldenSet'],
  calendario: ['dataInicio', 'dataFim'],
  inscricoes: ['inscricoesAbertas', 'inscricoesAberturaEm', 'inscricoesEncerramentoEm', 'inscricaoPermiteEdicaoAposEnvio', 'inscricaoPrazoEdicaoDias', 'elencoQuantidadeMinima', 'elencoQuantidadeMaxima', 'elencoCadastroDuranteInscricao', 'prazoAlteracaoElencoDias', 'qrCodeEnabled', 'formularioInscricaoConfig'],
}

export function categoryIdFromRequest(req: NextRequest) {
  const value = new URL(req.url).searchParams.get('categoriaCampeonatoId')
  return value && value.length > 0 ? value : null
}

export async function loadCategorySection(req: NextRequest, ligaId: number) {
  const categoryId = categoryIdFromRequest(req)
  if (!categoryId) return null
  try {
    return success(await getCategoryConfiguration(ligaId, categoryId))
  } catch (cause) {
    if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
    return error('Não foi possível carregar a categoria.', 500)
  }
}

export async function saveCategorySection(args: {
  req: NextRequest
  ligaId: number
  organizadorId: string
  section: keyof typeof ALLOWED
  patch: Record<string, unknown>
  intent: SetupIntent
}) {
  const categoryId = categoryIdFromRequest(args.req)
  if (!categoryId) return null
  try {
    const config = await getCategoryConfiguration(args.ligaId, categoryId)
    const allowed = new Set(ALLOWED[args.section])
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args.patch)) {
      if (!allowed.has(key)) continue
      if (key === 'elencoCadastroDuranteInscricao' && value !== true) continue
      patch[key] = value
    }
    const { data, error: rpcError } = await db.rpc('salvar_configuracao_categoria', {
      p_liga_id: args.ligaId,
      p_categoria_id: categoryId,
      p_organizador_id: args.organizadorId,
      p_versao: config.versao,
      p_secao: args.section,
      p_patch: patch,
      p_concluir: args.intent === 'complete',
    })
    if (rpcError) {
      const message = /Operacao iniciada/i.test(rpcError.message)
        ? 'Esta categoria já tem equipes ou jogos. Essa seção não pode mais ser alterada.'
        : /Versao alterada/i.test(rpcError.message)
          ? 'A categoria foi atualizada em outra tela. Recarregue e tente de novo.'
          : 'A configuração da categoria não foi aceita. Revise os campos.'
      return error(message, /Versao alterada|Operacao iniciada/i.test(rpcError.message) ? 409 : 422)
    }
    const saved = data && typeof data === 'object' ? data : config
    return success({ ...saved, setupStatus: args.intent === 'complete' ? 'completed' : 'in-progress' })
  } catch (cause) {
    if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
    return error('Não foi possível salvar a categoria.', 500)
  }
}
