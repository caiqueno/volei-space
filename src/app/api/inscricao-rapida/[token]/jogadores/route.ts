import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import { criarJogadorInscricaoRascunhoSchema } from '@/lib/schemas'
import { createRegistrationPlayer, descartarCamposMascarados, mascararAtletaInscricao, RegistrationDraftError } from '@/lib/team-registration-draft'
type Context = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { token } = await params
    // Valor mascarado vindo da tela de leitura não é dado novo: sai antes da validação.
    const parsed = criarJogadorInscricaoRascunhoSchema.safeParse(descartarCamposMascarados(await req.json()))
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    return success(mascararAtletaInscricao(await createRegistrationPlayer(token, parsed.data)), 201)
  } catch (err) {
    if (err instanceof RegistrationDraftError) return error(err.message, err.status, err.details)
    console.error('[inscricao-rapida] erro ao salvar jogador', err)
    return error('Erro ao salvar jogador.', 500)
  }
}
