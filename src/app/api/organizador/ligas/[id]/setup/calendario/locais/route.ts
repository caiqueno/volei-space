import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireOwnedLigaForSetup, upsertSetupSectionStatus, readJsonBody } from '@/lib/championship-setup-access'
import { ligaLocalSchema } from '@/lib/schemas'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { describeSchemaError } from '@/lib/setup-field-errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,organizadorId')
  if (liga instanceof Response) return liga

  const { data, error: err } = await supabase
    .from('LigaLocal')
    .select('id,nome,endereco,quadra,ordem')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  if (err) {
    console.error('[calendario/locais] erro ao buscar', err)
    return error('Erro ao buscar locais do campeonato.', 500)
  }
  return success(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,organizadorId,dataInicio,dataFim')
  if (liga instanceof Response) return liga
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = ligaLocalSchema.safeParse(body)
  if (!parsed.success) {
    const described = describeSchemaError(parsed.error)
    console.error('[calendario/locais] dados inválidos', described)
    return error(described.messages.join(' ') || 'Dados inválidos', 422, described)
  }

  const { count } = await supabase.from('LigaLocal').select('id', { count: 'exact', head: true }).eq('ligaId', ligaId)

  const { data, error: insertErr } = await supabase
    .from('LigaLocal')
    .insert({ ligaId, ...parsed.data, ordem: parsed.data.ordem ?? (Number(count ?? 0) + 1) })
    .select('id,nome,endereco,quadra,ordem')
    .single()
  if (insertErr) {
    console.error('[calendario/locais] erro ao criar', insertErr)
    return error('Erro ao criar local do campeonato.', 500)
  }

  const status = await upsertSetupSectionStatus(ligaId, 'calendario', liga)
  return success({ ...data, setupStatus: status }, 201)
}
