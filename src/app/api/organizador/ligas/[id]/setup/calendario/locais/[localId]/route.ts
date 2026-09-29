import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireOwnedLigaForSetup, readJsonBody } from '@/lib/championship-setup-access'
import { ligaLocalSchema } from '@/lib/schemas'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; localId: string }> }) {
  const { id, localId } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,organizadorId')
  if (liga instanceof Response) return liga
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = ligaLocalSchema.partial().safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  const { data, error: updateErr } = await supabase
    .from('LigaLocal')
    .update(parsed.data)
    .eq('id', localId)
    .eq('ligaId', ligaId)
    .select('id,nome,endereco,quadra,ordem')
    .single()
  if (updateErr) return error('Erro ao atualizar local do campeonato.', 500, updateErr)

  return success(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; localId: string }> }) {
  const { id, localId } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, 'id,organizadorId')
  if (liga instanceof Response) return liga
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio

  const { error: deleteErr } = await supabase.from('LigaLocal').delete().eq('id', localId).eq('ligaId', ligaId)
  if (deleteErr) return error('Erro ao remover local do campeonato.', 500, deleteErr)

  return success({ deleted: true, id: localId })
}
