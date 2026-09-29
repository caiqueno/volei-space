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
import { setupClassificacaoSchema } from '@/lib/schemas'
import { loadCategorySection, saveCategorySection } from '@/lib/category-setup-delegate'

// setsPorPartida é só leitura aqui (pertence à Estrutura) — usado só para
// pré-preencher a tabela de pontuação com o exemplo certo (melhor-de-3 vs
// melhor-de-5); nunca faz parte de setupClassificacaoSchema, então esta
// seção nunca escreve nele.
const COLUMNS = 'id,organizadorId,status,criteriosClassificacao,pontuacaoResultado,classificadosPorGrupo,melhoresClassificadosGerais,setsPorPartida'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const liga = await requireOwnedLigaForSetup(req, Number(id), COLUMNS)
  if (liga instanceof Response) return liga
  const categoryView = await loadCategorySection(req, Number(id))
  if (categoryView) return categoryView
  return success(liga)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = setupClassificacaoSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  if (await isLigaEmAndamento(ligaId, liga.status as string | null)) {
    const locked = rejectLockedFields('classificacao', parsed.data)
    if (locked) return locked
  }

  const intent = readSetupIntent(req)
  const categorySave = await saveCategorySection({
    req, ligaId, organizadorId: String(liga.organizadorId), section: 'classificacao', patch: parsed.data, intent,
  })
  if (categorySave) return categorySave
  const applied = await applySectionPatch({
    ligaId,
    section: 'classificacao',
    intent,
    liga,
    patch: parsed.data,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar a classificação do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'classificacao', intent, ligaAfterPatch: applied.data })
  if (finalized instanceof Response) return finalized

  return success({ ...applied.data, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
