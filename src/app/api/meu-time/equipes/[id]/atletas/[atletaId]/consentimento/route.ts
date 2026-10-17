import { ErroMeuTime, lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirAtletaDoClube, exigirEquipe } from '@/lib/meu-time/dados'
import { consentimentosAtivos, paraEstado, registrarConsentimento, revogarConsentimento } from '@/lib/lgpd/consentimento'
import { ehMenorDeIdade } from '@/lib/lgpd/idade'
import { consentimentoSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string; atletaId: string }

async function exigirMenor(clubeId: string, atletaId: string) {
  const atleta = await exigirAtletaDoClube(clubeId, atletaId)
  if (!ehMenorDeIdade(atleta.dataNascimento)) {
    throw new ErroMeuTime('Este atleta não é menor de 18 anos; não há autorização de responsável a registrar.', 422, 'ATLETA_MAIOR_DE_IDADE')
  }
  return atleta
}

// POST { responsavel: { nome, contato }, aceiteResponsavel: true }: completa (ou renova) a autorização do responsável
// de um atleta menor. O servidor grava versão do termo, data/hora e quem registrou; o contato é cifrado e nunca devolvido.
export const POST = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const entrada = validar(consentimentoSchema, await lerCorpo(req))
  const atleta = await exigirMenor(equipe.clubeId, params.atletaId)
  return sucesso(await registrarConsentimento(usuarioId, atleta.id, entrada.responsavel), 201)
})

// DELETE: revoga a autorização ativa (o atleta volta a "pendente"). Idempotente.
export const DELETE = rotaMeuTime<Params>(async ({ usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const atleta = await exigirAtletaDoClube(equipe.clubeId, params.atletaId)
  await revogarConsentimento(usuarioId, atleta.id)
  const ativos = await consentimentosAtivos([atleta.id])
  return sucesso(paraEstado(atleta.id, ativos.get(atleta.id)))
})
