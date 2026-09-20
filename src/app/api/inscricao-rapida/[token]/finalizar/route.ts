import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { finalizarInscricaoEquipeRascunhoSchema } from '@/lib/schemas'
import { finalizeRegistration, RegistrationDraftError } from '@/lib/team-registration-draft'
import { errorDetail } from '@/lib/error-detail'

type Context = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { token } = await params
    const parsed = finalizarInscricaoEquipeRascunhoSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    return success(await finalizeRegistration(token))
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    console.error('[inscricao-rapida] erro ao finalizar rascunho', err)
    return error(`Erro ao concluir inscrição: ${errorDetail(err)}`, 500)
  }
}
