import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { atualizarJogadorInscricaoRascunhoSchema } from '@/lib/schemas'
import { deleteRegistrationPlayer, RegistrationDraftError, updateRegistrationPlayer } from '@/lib/team-registration-draft'

type Context = { params: Promise<{ token: string; jogadorId: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const { token, jogadorId } = await params
    const parsed = atualizarJogadorInscricaoRascunhoSchema.safeParse(await req.json())
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    return success(await updateRegistrationPlayer(token, jogadorId, parsed.data))
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    console.error('[inscricao-rapida] erro ao atualizar jogador', err)
    return error('Erro ao atualizar jogador.', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const { token, jogadorId } = await params
    await deleteRegistrationPlayer(token, jogadorId)
    return success({ removed: true })
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    console.error('[inscricao-rapida] erro ao excluir jogador', err)
    return error('Erro ao excluir jogador.', 500)
  }
}
