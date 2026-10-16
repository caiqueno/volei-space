import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error } from '@/lib/api-response'

// Capitão cuja candidatura ainda não tem equipe vinculada não consegue enviar logo, foto nem
// documento (os caminhos nascem da equipe). Em vez de um 404 genérico, a API explica o motivo.

export const MENSAGEM_CADASTRO_INCOMPLETO =
  'Cadastro incompleto: sua equipe ainda não está vinculada a um campeonato, por isso o envio de logo, fotos e documentos ainda não está disponível. Conclua o cadastro ou aguarde a liberação do organizador.'

export const MENSAGEM_EQUIPE_NAO_ENCONTRADA = 'Equipe não encontrada ou ainda não vinculada.'

/** A candidatura existe e não tem equipe vinculada. */
export async function candidaturaSemEquipe(candidaturaId: string): Promise<boolean> {
  const { data } = await supabase.from('CandidaturaEquipe').select('id,equipeId').eq('id', candidaturaId).maybeSingle()
  return Boolean(data && !data.equipeId)
}

/** 409 com mensagem de cadastro incompleto, ou o 404 antigo quando a candidatura nem existe. */
export async function respostaEquipeNaoVinculada(candidaturaId: string) {
  if (await candidaturaSemEquipe(candidaturaId)) {
    return error(MENSAGEM_CADASTRO_INCOMPLETO, 409, { codigo: 'CADASTRO_INCOMPLETO' })
  }
  return error(MENSAGEM_EQUIPE_NAO_ENCONTRADA, 404)
}
