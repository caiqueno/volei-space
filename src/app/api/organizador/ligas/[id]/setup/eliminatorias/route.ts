import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import {
  requireOwnedLigaForSetup,
  applySectionPatch,
  finalizeSectionPatch,
  isLigaEmAndamento,
  rejectLockedFields,
  readJsonBody,
  readSetupIntent,
} from '@/lib/championship-setup-access'
import { setupEliminatoriasSchema } from '@/lib/schemas'
import { loadCategorySection, saveCategorySection } from '@/lib/category-setup-delegate'

// formato/quantidadeEquipes/quantidadeGrupos/classificadosPorGrupo/
// melhoresClassificadosGerais são só leitura aqui (pertencem a
// Estrutura/Classificação) — usados só para calcular a fase eliminatória
// inicial automaticamente. Nunca fazem parte de setupEliminatoriasSchema,
// então esta seção nunca escreve neles.
const COLUMNS = 'id,organizadorId,status,faseEliminatoria,metodoChaveamento,eliminatoriaIdaVolta,disputaTerceiroLugar,goldenSet,formato,quantidadeEquipes,quantidadeGrupos,classificadosPorGrupo,melhoresClassificadosGerais'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const liga = await requireOwnedLigaForSetup(req, Number(id), COLUMNS)
  if (liga instanceof Response) return liga
  const categoryView = await loadCategorySection(req, Number(id))
  if (categoryView) return categoryView
  return success(liga)
}

// Se faseEliminatoria='NENHUMA' (default), a sessão fica automaticamente
// concluída ao ser salva — isso é intencional: representa a spec "se a
// competição não possuir fase eliminatória... concluída automaticamente
// como não aplicável", sem exigir parametrização inexistente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = setupEliminatoriasSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  if (await isLigaEmAndamento(ligaId, liga.status as string | null)) {
    const locked = rejectLockedFields('eliminatorias', parsed.data)
    if (locked) return locked
  }

  const intent = readSetupIntent(req)
  const categorySave = await saveCategorySection({
    req, ligaId, organizadorId: String(liga.organizadorId), section: 'eliminatorias', patch: parsed.data, intent,
  })
  if (categorySave) return categorySave
  const applied = await applySectionPatch({
    ligaId,
    section: 'eliminatorias',
    intent,
    liga,
    patch: parsed.data,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar as eliminatórias do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'eliminatorias', intent, ligaAfterPatch: applied.data })
  if (finalized instanceof Response) return finalized

  return success({ ...applied.data, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
