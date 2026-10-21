import { lerCorpo, rotaMeuTime, sucesso, validar } from '@/lib/meu-time/acesso'
import { editarAtletaCompleto } from '@/lib/meu-time/atleta-dados'
import { editarAtleta, exigirEquipe, removerAtleta } from '@/lib/meu-time/dados'
import { elencoCompletoAtivo } from '@/lib/meu-time/elenco'
import { editarAtletaElencoSchema, editarAtletaSchema, exclusaoAtletaSchema } from '@/lib/meu-time/schemas'

export const dynamic = 'force-dynamic'

type Params = { id: string; atletaId: string }

// PATCH: edita nome, nascimento, número preferido ou posição de um atleta do banco do time.
// Para atleta menor aceita também { responsavel: { nome, contato }, aceiteResponsavel: true } (contato nunca volta na resposta).
export const PATCH = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const corpo = await lerCorpo(req)
  // R17 (ELENCO_COMPLETO_ATIVO=1): também aceita cpf, documentoTipo, documentoNumero, telefone e telefoneEmergencia.
  // Cifrados no servidor; a resposta só traz máscara. Com a flag desligada, o comportamento antigo não muda.
  if (elencoCompletoAtivo()) {
    return sucesso(await editarAtletaCompleto(equipe.clubeId, params.atletaId, validar(editarAtletaElencoSchema, corpo), usuarioId))
  }
  const entrada = validar(editarAtletaSchema, corpo)
  return sucesso(await editarAtleta(equipe.clubeId, params.atletaId, entrada, usuarioId))
})

// DELETE: pedido de exclusão. Anonimiza a PII (cpf, documento, foto, contato do responsável), registra quem/quando/motivo
// e tira o atleta do banco do time. Histórico de jogos e cópias em inscrições permanecem. Corpo opcional: { motivo? }.
export const DELETE = rotaMeuTime<Params>(async ({ req, usuarioId, params }) => {
  const { equipe } = await exigirEquipe(usuarioId, params.id, 'escrita')
  const texto = await req.text()
  let corpo: unknown = {}
  if (texto.trim()) {
    try {
      corpo = JSON.parse(texto)
    } catch {
      corpo = null
    }
  }
  const { motivo } = validar(exclusaoAtletaSchema, corpo ?? 'inválido')
  const resultado = await removerAtleta(usuarioId, equipe.clubeId, params.atletaId, motivo ?? null)
  return sucesso(resultado)
})
