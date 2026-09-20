import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { criarJogadorInscricaoRascunhoSchema } from '@/lib/schemas'
import { createRegistrationPlayer, RegistrationDraftError } from '@/lib/team-registration-draft'
import { errorDetail } from '@/lib/error-detail'

type Context = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { token } = await params
    const parsed = criarJogadorInscricaoRascunhoSchema.safeParse(await req.json())
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    return success(await createRegistrationPlayer(token, parsed.data), 201)
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    return error(`Erro ao salvar jogador: ${errorDetail(err)}`, 500)
  }
}
