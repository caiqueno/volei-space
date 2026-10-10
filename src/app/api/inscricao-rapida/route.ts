import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { criarInscricaoEquipeRascunhoSchema } from '@/lib/schemas'
import { createRegistrationDraft, RegistrationDraftError } from '@/lib/team-registration-draft'
// Cria apenas o rascunho persistente. A Equipe canônica nasce na finalização.
export async function POST(req: NextRequest) {
  try {
    const parsed = criarInscricaoEquipeRascunhoSchema.safeParse(await req.json())
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const draft = await createRegistrationDraft(parsed.data)
    return success({ token: draft.token, draft }, 201)
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    console.error('[inscricao-rapida] erro ao criar rascunho', err)
    return error('Erro ao iniciar inscrição.', 500)
  }
}
