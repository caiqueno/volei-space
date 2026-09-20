import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { atualizarInscricaoEquipeRascunhoSchema } from '@/lib/schemas'
import { getRegistrationDraftByToken, RegistrationDraftError, updateRegistrationDraft } from '@/lib/team-registration-draft'
import { errorDetail } from '@/lib/error-detail'

type Context = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const { token } = await params
    return success(await getRegistrationDraftByToken(token))
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    return error(`Erro ao carregar inscrição: ${errorDetail(err)}`, 500)
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const { token } = await params
    const parsed = atualizarInscricaoEquipeRascunhoSchema.safeParse(await req.json())
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    return success(await updateRegistrationDraft(token, parsed.data))
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    return error(`Erro ao salvar inscrição: ${errorDetail(err)}`, 500)
  }
}
