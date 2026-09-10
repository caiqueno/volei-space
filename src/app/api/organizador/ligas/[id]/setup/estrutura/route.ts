// ATENÇÃO: esta rota configura só as REGRAS da estrutura (formato,
// quantidade prevista/min/max, quantidade de grupos, sets/pontos/tie-break,
// turno-returno, contratação de Súmula+Scouts). NÃO confundir com
// src/app/api/organizador/ligas/[id]/estrutura/route.ts, que é a
// distribuição REAL de equipes aprovadas em grupos + geração de confrontos
// (roda depois que as inscrições fecham, inalterada por esta refatoração).
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
import { setupEstruturaSchema } from '@/lib/schemas'

const COLUMNS = 'id,organizadorId,status,quantidadeEquipes,quantidadeEquipesMinima,quantidadeEquipesMaxima,formato,quantidadeGrupos,turnoReturno,setsFormato,setsPorPartida,pontosPorSet,diferencaMinimaSet,tieBreakUltimoSet,pontosUltimoSet,sumulaScoutsEnabled'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const liga = await requireOwnedLigaForSetup(req, Number(id), COLUMNS)
  if (liga instanceof Response) return liga
  return success(liga)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = setupEstruturaSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  if (await isLigaEmAndamento(ligaId, liga.status as string | null)) {
    const locked = rejectLockedFields('estrutura', parsed.data)
    if (locked) return locked
  }

  const intent = readSetupIntent(req)
  const applied = await applySectionPatch({
    ligaId,
    section: 'estrutura',
    intent,
    liga,
    patch: parsed.data,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar a estrutura do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'estrutura', intent, ligaAfterPatch: applied.data })

  return success({ ...applied.data, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
