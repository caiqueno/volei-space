// Calendário desta Central é intencionalmente simples: só data de início e
// data final do campeonato (Liga.dataInicio/dataFim, reaproveitadas — não
// duplicadas). Não gera calendário automático de partidas; datas/horários
// específicos de cada jogo continuam manuais, via
// src/app/painel/estrutura/page.tsx e o calendário de partidas já existente.
// Locais ficam em ./locais (CRUD de LigaLocal).
import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import {
  requireOwnedLigaForSetup,
  applySectionPatch,
  finalizeSectionPatch,
  isLigaEmAndamento,
  rejectLockedFields,
  readJsonBody,
  readSetupIntent,
} from '@/lib/championship-setup-access'
import { setupCalendarioSchema } from '@/lib/schemas'
import { describeSchemaError } from '@/lib/setup-field-errors'
import { coerceIsoDate } from '@/lib/date-brazil'

const COLUMNS = 'id,organizadorId,status,dataInicio,dataFim'

async function listLocais(ligaId: number) {
  const { data } = await supabase
    .from('LigaLocal')
    .select('id,nome,endereco,quadra,ordem')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  return data ?? []
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  return success({ ...liga, locais: await listLocais(ligaId) })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  for (const key of ['dataInicio', 'dataFim'] as const) {
    if (typeof body[key] === 'string' && body[key]) {
      const iso = coerceIsoDate(body[key] as string)
      if (iso) body[key] = iso
    }
  }

  const parsed = setupCalendarioSchema.safeParse(body)
  if (!parsed.success) {
    const described = describeSchemaError(parsed.error)
    console.error('[calendario] dados inválidos', described)
    return error(described.messages.join(' ') || 'Dados inválidos', 422, described)
  }

  if (await isLigaEmAndamento(ligaId, liga.status as string | null)) {
    const locked = rejectLockedFields('calendario', parsed.data)
    if (locked) return locked
  }

  const intent = readSetupIntent(req)
  const applied = await applySectionPatch({
    ligaId,
    section: 'calendario',
    intent,
    liga,
    patch: parsed.data,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar o calendário do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'calendario', intent, ligaAfterPatch: applied.data })

  // Devolve `locais` também no PATCH (o GET já devolvia) para o wizard não
  // precisar de um segundo fetch depois de cada autosave.
  return success({
    ...applied.data,
    locais: await listLocais(ligaId),
    setupStatus: finalized.setupStatus,
    issues: finalized.issues,
  })
}
